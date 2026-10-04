"""Contractors, their agreements, bills and payments.

The running account of an agreement:
  earned       = work billed (gross) − WHT deducted
  retention    = held back from each bill until released
  due now      = earned − retention still held − everything paid
A negative "due now" means more has been paid (e.g. an advance) than billed."""

from sqlalchemy.orm import Session, joinedload

from app.core.payment_details import apply_payment_mode
from app.core.sequences import next_persistent_sequence_number, next_sequence_number
from app.models.account import Account, AccountNature
from app.models.contractor import (
    ContractAgreement,
    Contractor,
    ContractorBill,
    ContractorPayment,
    ContractorPaymentPurpose,
    ContractStatus,
)
from app.models.project import Project
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.contractor import (
    ContractAgreementCreate,
    ContractAgreementUpdate,
    ContractorBillCreate,
    ContractorCreate,
    ContractorPaymentCreate,
    ContractorUpdate,
)

CONTRACTOR_CHARGES_ACCOUNT_CODE = "5080"


def _get_or_create_contractor_charges_account(db: Session) -> Account:
    account = db.query(Account).filter(Account.code == CONTRACTOR_CHARGES_ACCOUNT_CODE).first()
    if account:
        return account
    expenses_group = db.query(Account).filter(Account.code == "5000").first()
    account = Account(
        code=CONTRACTOR_CHARGES_ACCOUNT_CODE,
        name="Contractor Charges",
        nature=AccountNature.EXPENSE,
        parent_id=expenses_group.id if expenses_group else None,
    )
    db.add(account)
    db.flush()
    return account


# Running account


def agreement_totals(agreement: ContractAgreement) -> dict[str, float]:
    billed = sum(float(b.gross_amount) for b in agreement.bills)
    retention_total = sum(float(b.retention_amount) for b in agreement.bills)
    wht_total = sum(float(b.wht_amount) for b in agreement.bills)
    paid = sum(float(p.amount) for p in agreement.payments)
    released = sum(
        float(p.amount) for p in agreement.payments if p.purpose == ContractorPaymentPurpose.RETENTION_RELEASE
    )
    advance = sum(float(p.amount) for p in agreement.payments if p.purpose == ContractorPaymentPurpose.ADVANCE)
    retention_held = max(retention_total - released, 0)
    return {
        "billed_gross": round(billed, 2),
        "retention_total": round(retention_total, 2),
        "retention_released": round(released, 2),
        "retention_held": round(retention_held, 2),
        "wht_total": round(wht_total, 2),
        "paid_total": round(paid, 2),
        "advance_paid": round(advance, 2),
        "due_now": round(billed - wht_total - retention_held - paid, 2),
        "remaining_work": round(float(agreement.contract_amount) - billed, 2),
    }


def _attach_totals(agreement: ContractAgreement) -> ContractAgreement:
    for key, value in agreement_totals(agreement).items():
        setattr(agreement, key, value)
    return agreement


# Contractors


def list_contractors(db: Session) -> list[Contractor]:
    contractors = (
        db.query(Contractor)
        .options(
            joinedload(Contractor.agreements).joinedload(ContractAgreement.bills),
            joinedload(Contractor.agreements).joinedload(ContractAgreement.payments),
        )
        .order_by(Contractor.name)
        .all()
    )
    for c in contractors:
        live = [a for a in c.agreements if a.status != ContractStatus.CANCELLED]
        totals = [agreement_totals(a) for a in c.agreements]
        c.agreement_count = len(live)
        c.total_contract = round(sum(float(a.contract_amount) for a in live), 2)
        c.total_billed = round(sum(t["billed_gross"] for t in totals), 2)
        c.total_paid = round(sum(t["paid_total"] for t in totals), 2)
        c.total_due = round(sum(t["due_now"] for t in totals), 2)
        c.total_retention_held = round(sum(t["retention_held"] for t in totals), 2)
    return contractors


def get_contractor(db: Session, contractor_id: int) -> Contractor | None:
    return db.query(Contractor).filter(Contractor.id == contractor_id).first()


def create_contractor(db: Session, contractor_in: ContractorCreate) -> Contractor:
    db_contractor = Contractor(
        contractor_code=next_persistent_sequence_number(db, Contractor.contractor_code, "CTR-", 5),
        **contractor_in.model_dump(),
    )
    db.add(db_contractor)
    db.commit()
    db.refresh(db_contractor)
    return db_contractor


def update_contractor(db: Session, db_contractor: Contractor, contractor_in: ContractorUpdate) -> Contractor:
    for field, value in contractor_in.model_dump().items():
        setattr(db_contractor, field, value)
    db.commit()
    db.refresh(db_contractor)
    return db_contractor


def delete_contractor(db: Session, db_contractor: Contractor) -> None:
    if db_contractor.agreements:
        refs = ", ".join(a.agreement_no for a in db_contractor.agreements)
        raise ValueError(
            f"This contractor has {len(db_contractor.agreements)} agreement(s): {refs}. "
            "Delete those first, or mark the contractor inactive instead."
        )
    db.delete(db_contractor)
    db.commit()


# Agreements


def _agreement_query(db: Session):
    return db.query(ContractAgreement).options(
        joinedload(ContractAgreement.project),
        joinedload(ContractAgreement.contractor),
        joinedload(ContractAgreement.bills),
        joinedload(ContractAgreement.payments).joinedload(ContractorPayment.credit_account),
    )


def list_agreements(
    db: Session, project_id: int | None = None, contractor_id: int | None = None
) -> list[ContractAgreement]:
    query = _agreement_query(db)
    if project_id is not None:
        query = query.filter(ContractAgreement.project_id == project_id)
    if contractor_id is not None:
        query = query.filter(ContractAgreement.contractor_id == contractor_id)
    return [_attach_totals(a) for a in query.order_by(ContractAgreement.id.desc()).all()]


def get_agreement(db: Session, agreement_id: int) -> ContractAgreement | None:
    agreement = _agreement_query(db).filter(ContractAgreement.id == agreement_id).first()
    return _attach_totals(agreement) if agreement else None


def _check_refs(db: Session, agreement_in: ContractAgreementCreate) -> None:
    if not db.get(Project, agreement_in.project_id):
        raise ValueError("Project not found")
    if not db.get(Contractor, agreement_in.contractor_id):
        raise ValueError("Contractor not found")


def create_agreement(db: Session, agreement_in: ContractAgreementCreate) -> ContractAgreement:
    _check_refs(db, agreement_in)
    db_agreement = ContractAgreement(
        agreement_no=next_persistent_sequence_number(db, ContractAgreement.agreement_no, "CTA-", 5),
        **agreement_in.model_dump(),
    )
    db.add(db_agreement)
    db.commit()
    return get_agreement(db, db_agreement.id)


def update_agreement(
    db: Session, db_agreement: ContractAgreement, agreement_in: ContractAgreementUpdate
) -> ContractAgreement:
    _check_refs(db, agreement_in)
    totals = agreement_totals(db_agreement)
    if agreement_in.contract_amount + 0.01 < totals["billed_gross"]:
        raise ValueError(
            f"PKR {totals['billed_gross']:,.2f} has already been billed on this agreement — "
            "the contract amount can't be less than that."
        )
    if (db_agreement.bills or db_agreement.payments) and (
        agreement_in.project_id != db_agreement.project_id
        or agreement_in.contractor_id != db_agreement.contractor_id
    ):
        raise ValueError("Bills or payments are recorded on this agreement — its project and contractor can't change.")
    for field, value in agreement_in.model_dump().items():
        setattr(db_agreement, field, value)
    db.commit()
    return get_agreement(db, db_agreement.id)


def delete_agreement(db: Session, db_agreement: ContractAgreement) -> None:
    if db_agreement.payments:
        raise ValueError(
            f"{len(db_agreement.payments)} payment(s) are recorded on this agreement — delete them first."
        )
    db.delete(db_agreement)  # bills go with it
    db.commit()


# Bills


def add_bill(db: Session, db_agreement: ContractAgreement, bill_in: ContractorBillCreate) -> ContractorBill:
    if db_agreement.status == ContractStatus.CANCELLED:
        raise ValueError("This agreement is cancelled.")
    totals = agreement_totals(db_agreement)
    remaining = float(db_agreement.contract_amount) - totals["billed_gross"]
    if bill_in.gross_amount > remaining + 0.01:
        raise ValueError(
            f"Only PKR {remaining:,.2f} of the contract is left to bill. "
            "If the work grew, edit the agreement's contract amount first."
        )
    gross = round(bill_in.gross_amount, 2)
    retention = round(gross * float(db_agreement.retention_percent) / 100, 2)
    wht = round(gross * float(db_agreement.wht_percent) / 100, 2)
    db_bill = ContractorBill(
        bill_no=next_persistent_sequence_number(db, ContractorBill.bill_no, "CTB-", 5),
        agreement_id=db_agreement.id,
        bill_date=bill_in.bill_date,
        description=bill_in.description,
        work_quantity=bill_in.work_quantity,
        gross_amount=gross,
        retention_amount=retention,
        wht_amount=wht,
        net_amount=round(gross - retention - wht, 2),
    )
    db.add(db_bill)
    db.commit()
    db.refresh(db_bill)
    return db_bill


def get_bill(db: Session, bill_id: int) -> ContractorBill | None:
    return db.query(ContractorBill).filter(ContractorBill.id == bill_id).first()


def delete_bill(db: Session, db_bill: ContractorBill) -> None:
    agreement = get_agreement(db, db_bill.agreement_id)
    totals = agreement_totals(agreement)
    # Without this bill, would more have been paid than was earned?
    earned_after = (totals["billed_gross"] - float(db_bill.gross_amount)) - (
        totals["wht_total"] - float(db_bill.wht_amount)
    )
    non_advance_paid = totals["paid_total"] - totals["advance_paid"]
    if non_advance_paid > earned_after + 0.01:
        raise ValueError(
            "Payments have already been made against this bill — delete those payments first."
        )
    db.delete(db_bill)
    db.commit()


# Payments


def _payment_query(db: Session):
    return db.query(ContractorPayment).options(
        joinedload(ContractorPayment.credit_account),
        joinedload(ContractorPayment.agreement).joinedload(ContractAgreement.project),
        joinedload(ContractorPayment.agreement).joinedload(ContractAgreement.contractor),
    )


def get_payment(db: Session, payment_id: int) -> ContractorPayment | None:
    return _payment_query(db).filter(ContractorPayment.id == payment_id).first()


def add_payment(
    db: Session, db_agreement: ContractAgreement, payment_in: ContractorPaymentCreate
) -> ContractorPayment:
    if db_agreement.status == ContractStatus.CANCELLED:
        raise ValueError("This agreement is cancelled.")
    totals = agreement_totals(db_agreement)
    amount = payment_in.amount
    if payment_in.purpose == ContractorPaymentPurpose.ADVANCE:
        limit = float(db_agreement.contract_amount) - totals["paid_total"]
        if amount > limit + 0.01:
            raise ValueError(f"An advance can be at most PKR {max(limit, 0):,.2f} (contract amount less what's paid).")
    elif payment_in.purpose == ContractorPaymentPurpose.RETENTION_RELEASE:
        if amount > totals["retention_held"] + 0.01:
            raise ValueError(f"Only PKR {totals['retention_held']:,.2f} of retention is being held.")
    elif amount > totals["due_now"] + 0.01:
        raise ValueError(
            f"Only PKR {max(totals['due_now'], 0):,.2f} is due on the bills so far. "
            "Record a bill for the work done first, or pay it as an Advance."
        )

    db_payment = ContractorPayment(
        payment_no=next_persistent_sequence_number(db, ContractorPayment.payment_no, "CTP-", 5),
        agreement_id=db_agreement.id,
        payment_date=payment_in.payment_date,
        purpose=payment_in.purpose,
        amount=amount,
        credit_account_id=payment_in.credit_account_id,
        narration=payment_in.narration,
    )
    apply_payment_mode(db_payment, payment_in)
    db.add(db_payment)
    db.flush()

    contractor = db_agreement.contractor
    expense_account = _get_or_create_contractor_charges_account(db)
    voucher = Voucher(
        voucher_no=next_sequence_number(db, Voucher.voucher_no, "PV-", 5),
        voucher_type=VoucherType.PAYMENT,
        voucher_date=payment_in.payment_date,
        project_id=db_agreement.project_id,
        narration=(
            f"Contractor payment {db_payment.payment_no} — {contractor.name} "
            f"({db_agreement.agreement_no}, {payment_in.purpose.value})"
        ),
    )
    db.add(voucher)
    db.flush()
    db.add(
        VoucherLine(
            voucher_id=voucher.id, account_id=expense_account.id, debit=amount, credit=0,
            narration=f"{db_agreement.scope_title} — {contractor.name}",
        )
    )
    db.add(
        VoucherLine(
            voucher_id=voucher.id, account_id=payment_in.credit_account_id, debit=0, credit=amount,
            narration=f"Paid to {contractor.name}",
        )
    )
    db_payment.voucher_id = voucher.id
    db.commit()
    return get_payment(db, db_payment.id)


def delete_payment(db: Session, db_payment: ContractorPayment) -> None:
    voucher_id = db_payment.voucher_id
    db.delete(db_payment)
    db.flush()
    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)
    db.commit()

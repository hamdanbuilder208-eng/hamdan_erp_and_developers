from app.crud import project as project_crud
from app.models.unit import UnitCategory
from app.schemas.project import PaymentTemplateLineCreate, PaymentTemplateUpsert


def _plan(booking_percent: float, monthly_percent: float) -> PaymentTemplateUpsert:
    return PaymentTemplateUpsert(
        booking_percent=booking_percent,
        lines=[PaymentTemplateLineCreate(no_of_installments=12, percent=monthly_percent)],
    )


def test_each_unit_category_gets_its_own_plan(db, project):
    one_bed = UnitCategory(name="1 Bed Lounge")
    two_bed = UnitCategory(name="2 Bed Lounge")
    db.add_all([one_bed, two_bed])
    db.commit()

    project_crud.upsert_payment_template(db, project.id, _plan(10, 90))
    project_crud.upsert_payment_template(db, project.id, _plan(20, 80), one_bed.id)
    project_crud.upsert_payment_template(db, project.id, _plan(30, 70), two_bed.id)
    # Saving again replaces that category's plan rather than adding another.
    project_crud.upsert_payment_template(db, project.id, _plan(25, 75), two_bed.id)

    templates = project_crud.list_payment_templates(db, project.id)
    assert len(templates) == 3
    assert templates[0].unit_category_id is None  # default listed first

    assert float(project_crud.get_payment_template(db, project.id).booking_percent) == 10
    assert float(project_crud.get_payment_template(db, project.id, one_bed.id).booking_percent) == 20
    assert float(project_crud.get_payment_template(db, project.id, two_bed.id).booking_percent) == 25


def test_category_without_plan_falls_back_to_default(db, project):
    studio = UnitCategory(name="Studio")
    db.add(studio)
    db.commit()
    project_crud.upsert_payment_template(db, project.id, _plan(10, 90))

    assert project_crud.get_payment_template(db, project.id, studio.id) is None
    fallback = project_crud.get_payment_template(db, project.id, studio.id, fallback=True)
    assert fallback is not None and fallback.unit_category_id is None

    project_crud.upsert_payment_template(db, project.id, _plan(15, 85), studio.id)
    project_crud.delete_payment_template(
        db, project_crud.get_payment_template(db, project.id, studio.id)
    )
    assert project_crud.get_payment_template(db, project.id, studio.id) is None
    assert project_crud.get_payment_template(db, project.id) is not None

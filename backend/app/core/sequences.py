from sqlalchemy.orm import Session


def next_sequence_number(db: Session, column, prefix: str, pad: int) -> str:
    """Generates the next `<prefix><zero-padded number>` value for a code/ref-no
    column by looking at the highest existing numeric suffix — not a row count,
    which collides once any row with that prefix has been deleted."""
    rows = db.query(column).filter(column.like(f"{prefix}%")).all()
    max_n = 0
    for (value,) in rows:
        suffix = value[len(prefix):]
        if suffix.isdigit():
            max_n = max(max_n, int(suffix))
    return f"{prefix}{max_n + 1:0{pad}d}"


def next_persistent_sequence_number(db: Session, column, prefix: str, pad: int) -> str:
    """Like next_sequence_number, but never re-issues a number: the last value
    handed out for `prefix` is stored in sequence_counters, so deleting the
    newest document (say PO-00005) doesn't make the next one PO-00005 again.
    Also starts past any number already in the table, for data created before
    the counter existed."""
    from app.models.sequence_counter import SequenceCounter

    existing = next_sequence_number(db, column, prefix, pad)
    max_existing = int(existing[len(prefix):]) - 1

    counter = db.get(SequenceCounter, prefix, with_for_update=True)
    if counter is None:
        counter = SequenceCounter(prefix=prefix, last_value=0)
        db.add(counter)
    n = max(counter.last_value or 0, max_existing) + 1
    counter.last_value = n
    db.flush()
    return f"{prefix}{n:0{pad}d}"

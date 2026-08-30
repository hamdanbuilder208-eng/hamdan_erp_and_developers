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

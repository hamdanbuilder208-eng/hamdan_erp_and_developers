from pydantic import BaseModel


class IntegrityCheckResult(BaseModel):
    name: str
    ok: bool
    issue_count: int
    details: list[str]


class DataIntegrityReport(BaseModel):
    results: list[IntegrityCheckResult]
    all_ok: bool

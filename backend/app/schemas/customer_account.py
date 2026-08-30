from pydantic import BaseModel, ConfigDict, Field

from app.schemas.allottee import AllotteeOut


class CustomerSignup(BaseModel):
    mobile: str
    cnic: str
    password: str = Field(min_length=6)


class CustomerAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    allottee: AllotteeOut


class CustomerChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class CustomerForgotPassword(BaseModel):
    mobile: str
    cnic: str
    new_password: str = Field(min_length=6)

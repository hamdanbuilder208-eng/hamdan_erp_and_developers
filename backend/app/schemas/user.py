from pydantic import BaseModel, ConfigDict, EmailStr


class RoleBase(BaseModel):
    name: str
    description: str | None = None
    is_admin: bool = False


class RoleCreate(RoleBase):
    allowed_modules: list[str] = []


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_admin: bool | None = None
    allowed_modules: list[str] | None = None


class RoleOut(RoleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    allowed_modules: list[str] = []


class ModuleInfo(BaseModel):
    key: str
    label: str


class UserBase(BaseModel):
    username: str
    email: EmailStr | None = None
    full_name: str | None = None
    is_active: bool = True
    role_id: int


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    is_active: bool | None = None
    role_id: int | None = None
    password: str | None = None


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    role: RoleOut

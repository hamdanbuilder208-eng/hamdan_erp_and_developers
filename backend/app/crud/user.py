from sqlalchemy.orm import Session, joinedload

from app.core.security import hash_password, verify_password
from app.models.user import Role, RoleModulePermission, User
from app.schemas.user import RoleCreate, RoleUpdate, UserCreate, UserUpdate


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_user(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def list_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    return db.query(User).offset(skip).limit(limit).all()


def create_user(db: Session, user_in: UserCreate) -> User:
    db_user = User(
        username=user_in.username,
        email=user_in.email,
        full_name=user_in.full_name,
        is_active=user_in.is_active,
        role_id=user_in.role_id,
        hashed_password=hash_password(user_in.password),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, db_user: User, user_in: UserUpdate) -> User:
    data = user_in.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        db_user.hashed_password = hash_password(data.pop("password"))
    else:
        data.pop("password", None)
    for field, value in data.items():
        setattr(db_user, field, value)
    db.commit()
    db.refresh(db_user)
    return db_user


def delete_user(db: Session, db_user: User) -> None:
    db.delete(db_user)
    db.commit()


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = get_user_by_username(db, username)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def _load_roles_query(db: Session):
    return db.query(Role).options(joinedload(Role.module_permissions))


def list_roles(db: Session) -> list[Role]:
    return _load_roles_query(db).order_by(Role.id.desc()).all()


def get_role(db: Session, role_id: int) -> Role | None:
    return _load_roles_query(db).filter(Role.id == role_id).first()


def create_role(db: Session, role_in: RoleCreate) -> Role:
    db_role = Role(
        name=role_in.name, description=role_in.description, is_admin=role_in.is_admin
    )
    db.add(db_role)
    db.flush()
    for module_key in role_in.allowed_modules:
        db.add(RoleModulePermission(role_id=db_role.id, module_key=module_key))
    db.commit()
    return get_role(db, db_role.id)


def update_role(db: Session, db_role: Role, role_in: RoleUpdate) -> Role:
    data = role_in.model_dump(exclude_unset=True)
    allowed_modules = data.pop("allowed_modules", None)
    for field, value in data.items():
        setattr(db_role, field, value)

    if allowed_modules is not None:
        db.query(RoleModulePermission).filter(RoleModulePermission.role_id == db_role.id).delete()
        for module_key in allowed_modules:
            db.add(RoleModulePermission(role_id=db_role.id, module_key=module_key))

    db.commit()
    return get_role(db, db_role.id)


def delete_role(db: Session, db_role: Role) -> None:
    users = db.query(User).filter(User.role_id == db_role.id).all()
    if users:
        names = ", ".join(u.username for u in users)
        raise ValueError(
            f"This role is assigned to {len(users)} user(s): {names}. "
            "Reassign them to another role first."
        )
    db.delete(db_role)
    db.commit()


def get_role_by_name(db: Session, name: str) -> Role | None:
    return db.query(Role).filter(Role.name == name).first()

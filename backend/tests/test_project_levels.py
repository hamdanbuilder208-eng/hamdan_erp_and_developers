import pytest

from app.crud import project as project_crud
from app.schemas.project import ProjectCreate, ProjectFloorCreate, ProjectUpdate


def test_special_levels_follow_project_settings(db):
    project = project_crud.create_project(
        db, ProjectCreate(project_name="Hall", total_floors=3, has_mezzanine=True)
    )
    assert project.has_ground and project.has_mezzanine and not project.has_lower_ground

    project_crud.create_floor(db, project.id, ProjectFloorCreate(floor_no="Mezzanine", no_of_units=2))
    with pytest.raises(ValueError, match="no Lower Ground"):
        project_crud.create_floor(db, project.id, ProjectFloorCreate(floor_no="Lower Ground"))

    # Can't switch a level off while a floor of it exists.
    with pytest.raises(ValueError, match="already has a Mezzanine"):
        project_crud.update_project(db, project, ProjectUpdate(has_mezzanine=False))

    project_crud.update_project(db, project, ProjectUpdate(has_lower_ground=True))
    project_crud.create_floor(db, project.id, ProjectFloorCreate(floor_no="Lower Ground"))

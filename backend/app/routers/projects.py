from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models import Project, Role, User
from app.schemas import ProjectIn, ProjectOut

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectIn, db: Session = Depends(get_db),
                   user: User = Depends(require_roles(Role.ngo_admin, Role.project_coordinator))):
    project = Project(**body.model_dump(), created_by=user.id)
    db.add(project)
    db.commit()
    return project


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.scalars(select(Project).order_by(Project.start_at)).all()


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project

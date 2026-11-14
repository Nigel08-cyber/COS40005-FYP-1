"""Staff side of contribution tracking (backlog item 27). The volunteer side (/me/contributions, /me/stats, /me/hours)
lives in volunteers.py. Contributions are created by QR check-out (attendance.py) and verified at creation."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit
from app.database import get_db
from app.deps import assert_ngo_staff, get_current_user
from app.models import Contribution, Event, Project, User
from app.schemas import ContributionStaffOut, ContributionStatusIn

router = APIRouter(tags=["contributions"])


@router.get("/projects/{project_id}/contributions", response_model=list[ContributionStaffOut])
def project_contributions(project_id: int, status_filter: str | None = None, db: Session = Depends(get_db),
                          user: User = Depends(get_current_user)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    assert_ngo_staff(db, user, project.ngo_id)
    q = (select(Contribution, User.full_name, Event.title).join(User, User.user_id == Contribution.user_id)
         .outerjoin(Event, Event.event_id == Contribution.event_id).where(Contribution.project_id == project_id))
    if status_filter:
        q = q.where(Contribution.status == status_filter)
    q = q.order_by(Contribution.contribution_date.desc(), Contribution.contribution_id.desc())
    return [ContributionStaffOut(contribution_id=c.contribution_id, user_id=c.user_id, volunteer_name=n, event_id=c.event_id,
                                 event_title=t, role=c.role, hours=c.hours, contribution_date=c.contribution_date,
                                 status=c.status, attendance_id=c.attendance_id) for c, n, t in db.execute(q).all()]


@router.patch("/contributions/{contribution_id}", response_model=ContributionStaffOut)
def set_contribution_status(contribution_id: int, body: ContributionStatusIn, db: Session = Depends(get_db),
                            user: User = Depends(get_current_user)):
    """Verify or reject logged hours. Rejected hours no longer count in totals, the dashboard or certificates."""
    c = db.get(Contribution, contribution_id)
    project = db.get(Project, c.project_id) if c else None
    if not c or not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contribution not found")
    assert_ngo_staff(db, user, project.ngo_id)
    old, c.status = c.status, body.status
    audit.record(db, user.user_id, "contribution.status", "contribution", contribution_id, {"from": old, "to": body.status})
    db.commit()
    volunteer = db.get(User, c.user_id)
    event = db.get(Event, c.event_id) if c.event_id else None
    return ContributionStaffOut(contribution_id=c.contribution_id, user_id=c.user_id, volunteer_name=volunteer.full_name,
                                event_id=c.event_id, event_title=event.title if event else None, role=c.role, hours=c.hours,
                                contribution_date=c.contribution_date, status=c.status, attendance_id=c.attendance_id)

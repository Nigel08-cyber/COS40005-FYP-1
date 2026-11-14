"""In-app notifications (bell icon) and the admin audit log viewer."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models import AuditLog, Notification, User
from app.schemas import AuditLogOut, NotificationOut, UnreadCountOut

router = APIRouter(tags=["notifications"])


def _mine(user: User):
    return (Notification.user_id == user.user_id, Notification.channel == "in_app")


def _out(n: Notification) -> NotificationOut:
    return NotificationOut(notification_id=n.notification_id, type=n.type, title=n.title, content=n.content,
                           related_type=n.related_type, related_id=n.related_id, is_read=n.is_read,
                           created_at=n.sent_at or n.scheduled_at)


@router.get("/me/notifications", response_model=list[NotificationOut])
def my_notifications(unread_only: bool = False, limit: int = Query(30, ge=1, le=100), offset: int = Query(0, ge=0),
                     db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = select(Notification).where(*_mine(user))
    if unread_only:
        q = q.where(Notification.is_read.is_(False))
    rows = db.scalars(q.order_by(Notification.notification_id.desc()).limit(limit).offset(offset)).all()
    return [_out(n) for n in rows]


@router.get("/me/notifications/unread-count", response_model=UnreadCountOut)
def unread_count(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return UnreadCountOut(unread=db.scalar(select(func.count()).select_from(Notification).where(
        *_mine(user), Notification.is_read.is_(False))) or 0)


@router.post("/me/notifications/read-all", status_code=204)
def read_all(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.execute(update(Notification).where(*_mine(user), Notification.is_read.is_(False)).values(is_read=True))
    db.commit()


@router.post("/me/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.user_id or n.channel != "in_app":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    n.is_read = True
    db.commit()
    return _out(n)


@router.get("/audit-logs", response_model=list[AuditLogOut])
def audit_logs(action: str | None = None, user_id: int | None = None, limit: int = Query(50, ge=1, le=200),
               offset: int = Query(0, ge=0), db: Session = Depends(get_db), _: User = Depends(require_roles())):
    """System admin only. Newest first. `action` matches the start of the action, e.g. 'POST /auth/login'."""
    q = select(AuditLog)
    if action:
        q = q.where(AuditLog.action.startswith(action))
    if user_id is not None:
        q = q.where(AuditLog.user_id == user_id)
    return db.scalars(q.order_by(AuditLog.log_id.desc()).limit(limit).offset(offset)).all()

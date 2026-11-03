"""Create a platform admin: python -m scripts.create_admin you@example.com "Full Name" """
import getpass
import sys

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import RefreshToken, User
from app.security import hash_password

email, name = sys.argv[1].lower(), sys.argv[2]
if engine.dialect.name == "sqlite":
    Base.metadata.create_all(engine)
else:
    RefreshToken.__table__.create(engine, checkfirst=True)
with SessionLocal() as db:
    if db.scalar(select(User).where(User.email == email)):
        sys.exit("User already exists")
    db.add(User(email=email, full_name=name, password_hash=hash_password(getpass.getpass("Password: ")), system_role="platform_admin"))
    db.commit()
    print("Platform admin created")

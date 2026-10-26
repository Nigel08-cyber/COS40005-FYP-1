"""Create the first System Admin: python -m scripts.create_admin you@example.com 'Full Name' """
import getpass
import sys

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import Role, User
from app.security import hash_password

email, name = sys.argv[1].lower(), sys.argv[2]
Base.metadata.create_all(engine)
with SessionLocal() as db:
    if db.scalar(select(User).where(User.email == email)):
        sys.exit("User already exists")
    db.add(User(email=email, full_name=name, password_hash=hash_password(getpass.getpass("Password: ")), role=Role.system_admin))
    db.commit()
    print("System Admin created")

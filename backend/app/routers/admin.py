from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from .. import schemas
from ..auth import require_admin
from .. import backup as backup_module

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/backups", response_model=list[schemas.BackupOut])
def list_backups():
    return backup_module.list_backups()


@router.post("/backups", response_model=schemas.BackupOut, status_code=201)
def create_backup():
    try:
        path = backup_module.create_backup()
    except backup_module.BackupError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    stat = path.stat()
    return {
        "filename": path.name,
        "size_bytes": stat.st_size,
        "created_at": datetime.utcfromtimestamp(stat.st_mtime),
    }

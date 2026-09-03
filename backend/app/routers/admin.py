from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

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


@router.get("/backups/{filename}/download")
def download_backup(filename: str):
    try:
        path = backup_module.get_backup_path(filename)
    except backup_module.BackupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    
    return FileResponse(
        path=path,
        filename=filename,
        media_type="application/octet-stream",
    )


@router.delete("/backups/{filename}", status_code=204)
def delete_backup_file(filename: str):
    try:
        backup_module.delete_backup(filename)
    except backup_module.BackupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

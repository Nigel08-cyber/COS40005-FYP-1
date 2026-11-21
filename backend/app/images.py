"""Small helper for the two image uploads (volunteer profile photo, organisation logo).

The client sends the raw image as the request body (Content-Type image/png, image/jpeg or image/webp), so no
multipart library is needed. The type is decided from the file's first bytes, never from the header, and SVG is
refused on purpose (it can carry scripts). Images are limited to 1 MB because they are stored in PostgreSQL.
"""
from fastapi import HTTPException, Request, status

MAX_IMAGE_BYTES = 1_000_000  # the database CHECK allows up to 1_048_576


def sniff_image_type(data: bytes) -> str | None:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


async def read_image(request: Request) -> tuple[bytes, str]:
    """The uploaded bytes and their real content type, or an HTTP error (400 empty, 413 too big, 415 not an image)."""
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "The image is larger than 1 MB")
    data = await request.body()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No image was sent")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "The image is larger than 1 MB")
    content_type = sniff_image_type(data)
    if not content_type:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Use a PNG, JPEG or WebP image")
    return data, content_type

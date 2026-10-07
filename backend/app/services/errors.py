"""Domain errors. Each carries the HTTP status the API should return for it."""


class GeoFileError(Exception):
    """Base class for problems with an uploaded file. Message is safe to show to the client."""

    status_code = 422

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class UnsupportedFileTypeError(GeoFileError):
    status_code = 415


class FileTooLargeError(GeoFileError):
    status_code = 413


class InvalidFileError(GeoFileError):
    status_code = 422


class UnsupportedGeometryError(ValueError):
    """A feature's geometry exists but is of a type we cannot represent or measure (e.g. KML <Model>)."""

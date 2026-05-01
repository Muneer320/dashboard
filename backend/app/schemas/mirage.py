from typing import Optional

from pydantic import BaseModel, Field


class MiragePhotoItem(BaseModel):
    photoId: str
    fileId: str
    name: str
    mimeType: str
    url: str
    caption: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    likeCount: int = 0
    liked: bool = False
    eventId: Optional[str] = None
    eventName: Optional[str] = None
    dayLabel: Optional[str] = None
    isFeatured: bool = False
    trendScore: Optional[int] = None


class MirageCollectionItem(BaseModel):
    id: str
    dayLabel: str
    sectionTitle: str
    eventId: Optional[str] = None
    eventName: Optional[str] = None
    driveFolderUrl: str
    driveFolderId: str
    recursive: bool = False
    sortOrder: int = 0
    imageCount: int = 0
    coverImage: Optional[MiragePhotoItem] = None
    previewImages: list[MiragePhotoItem] = Field(default_factory=list)
    highlightImages: list[MiragePhotoItem] = Field(default_factory=list)
    images: list[MiragePhotoItem] = Field(default_factory=list)


class MirageGalleryDayItem(BaseModel):
    dayLabel: str
    sections: list[MirageCollectionItem] = Field(default_factory=list)


class MirageOverviewDayGroup(BaseModel):
    dayLabel: str
    collections: list[MirageCollectionItem] = Field(default_factory=list)


class MirageOverviewResponse(BaseModel):
    totalPhotos: int = 0
    totalCollections: int = 0
    dayLabels: list[str] = Field(default_factory=list)
    highlights: list[MiragePhotoItem] = Field(default_factory=list)
    trending: list[MiragePhotoItem] = Field(default_factory=list)
    featuredCollections: list[MirageCollectionItem] = Field(default_factory=list)
    collectionsByDay: list[MirageOverviewDayGroup] = Field(default_factory=list)


class MirageCollectionDetailResponse(BaseModel):
    collection: MirageCollectionItem
    relatedCollections: list[MirageCollectionItem] = Field(default_factory=list)


class MirageLikeResponse(BaseModel):
    photoId: str
    liked: bool
    likeCount: int


class MirageAdminSectionCreate(BaseModel):
    dayLabel: str
    sectionTitle: str
    driveFolderUrl: str
    eventId: Optional[str] = None
    eventName: Optional[str] = None
    recursive: bool = False
    sortOrder: int = 0
    isPublished: bool = True


class MirageAdminSectionUpdate(BaseModel):
    dayLabel: Optional[str] = None
    sectionTitle: Optional[str] = None
    driveFolderUrl: Optional[str] = None
    eventId: Optional[str] = None
    eventName: Optional[str] = None
    recursive: Optional[bool] = None
    sortOrder: Optional[int] = None
    isPublished: Optional[bool] = None


class MirageAdminSectionItem(BaseModel):
    id: str
    dayLabel: str
    sectionTitle: str
    eventId: Optional[str] = None
    eventName: Optional[str] = None
    driveFolderUrl: str
    driveFolderId: str
    recursive: bool = False
    sortOrder: int = 0
    isPublished: bool = True
    imageCount: int = 0
    sampleImages: list[str] = Field(default_factory=list)
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

from typing import Literal, Optional

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
    jobId: Optional[str] = None
    isFeatured: bool = False
    trendScore: Optional[int] = None
    matchedForCurrentUser: bool = False


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


class MirageAnchorImageItem(BaseModel):
    imageId: str
    filename: str
    status: str
    poseLabel: Optional[str] = None
    qualityScore: Optional[float] = None
    rejectionReason: Optional[str] = None
    previewUrl: Optional[str] = None
    createdAt: Optional[str] = None


class MirageUserProfileResponse(BaseModel):
    userId: str
    consentEnabled: bool = False
    enrollmentStatus: str = "draft"
    approvedAnchorCount: int = 0
    requiredAnchorCount: int = 6
    maxAnchorCount: int = 10
    readyForSubmission: bool = False
    images: list[MirageAnchorImageItem] = Field(default_factory=list)


class MirageUserProfileSubmitRequest(BaseModel):
    consentEnabled: bool = False


class MirageJobCreateRequest(BaseModel):
    dayLabel: str
    jobId: Optional[str] = None
    eventId: Optional[str] = None
    eventNameSnapshot: Optional[str] = None
    driveFolderUrl: str
    driveFileIds: list[str] = Field(default_factory=list)
    driveImageUrls: list[str] = Field(default_factory=list)
    recursive: bool = False
    matchingMode: Literal["high_precision", "balanced", "high_recall"] = "high_precision"
    forceRecheck: bool = False
    onlyPending: bool = True
    userScope: str = "all"
    imageScope: str = "all"


class MirageJobListItem(BaseModel):
    jobId: str
    eventId: Optional[str] = None
    eventNameSnapshot: Optional[str] = None
    dayLabel: str
    driveFolderUrl: str
    driveFolderId: str
    matchingMode: str
    recursive: bool = False
    status: str
    imageCount: int = 0
    processedImageCount: int = 0
    approvedImageCount: int = 0
    reviewRequiredCount: int = 0
    pendingImageCount: int = 0
    failedImageCount: int = 0
    pendingPairCount: int = 0
    positivePairCount: int = 0
    negativePairCount: int = 0
    failedPairCount: int = 0
    liveAt: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class MirageFaceMatchCandidateItem(BaseModel):
    matchId: str
    userId: Optional[str] = None
    userName: Optional[str] = None
    bestScore: Optional[float] = None
    secondBestScore: Optional[float] = None
    margin: Optional[float] = None
    autoDecision: Optional[str] = None
    reviewDecision: Optional[str] = None
    reviewedAt: Optional[str] = None


class MirageDetectedFaceItem(BaseModel):
    faceId: str
    bbox: dict = Field(default_factory=dict)
    landmarks: list[dict] = Field(default_factory=list)
    detectionScore: Optional[float] = None
    qualityScore: Optional[float] = None
    status: str = "unknown"
    matches: list[MirageFaceMatchCandidateItem] = Field(default_factory=list)


class MirageJobImageItem(BaseModel):
    jobImageId: str
    fileId: Optional[str] = None
    filename: str
    url: str
    displayOrder: int = 0
    status: str
    rerunReason: Optional[str] = None
    detectedFaces: list[MirageDetectedFaceItem] = Field(default_factory=list)


class MirageJobDetailResponse(BaseModel):
    jobId: str
    eventId: Optional[str] = None
    eventNameSnapshot: Optional[str] = None
    dayLabel: str
    driveFolderUrl: str
    driveFolderId: str
    matchingMode: str
    recursive: bool = False
    status: str
    imageCount: int = 0
    processedImageCount: int = 0
    approvedImageCount: int = 0
    reviewRequiredCount: int = 0
    pendingImageCount: int = 0
    failedImageCount: int = 0
    pendingPairCount: int = 0
    positivePairCount: int = 0
    negativePairCount: int = 0
    failedPairCount: int = 0
    stats: dict = Field(default_factory=dict)
    reviewSummary: dict = Field(default_factory=dict)
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    approvedAt: Optional[str] = None
    liveAt: Optional[str] = None
    images: list[MirageJobImageItem] = Field(default_factory=list)


class MirageJobImageReviewRequest(BaseModel):
    status: Literal["approved", "rejected", "rerun_requested"]
    rerunReason: Optional[str] = None


class MirageJobImageReviewResponse(BaseModel):
    jobImageId: str
    status: str
    rerunReason: Optional[str] = None


class MirageFaceMatchReviewRequest(BaseModel):
    reviewDecision: Literal["approved", "rejected", "unknown"]


class MirageFaceMatchReviewResponse(BaseModel):
    matchId: str
    reviewDecision: str


class MirageJobStatusResponse(BaseModel):
    jobId: str
    status: str

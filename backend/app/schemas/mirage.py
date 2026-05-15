from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class MiragePhotoItem(BaseModel):
    photoId: str
    fileId: str
    name: str
    mimeType: str
    url: str
    downloadUrl: Optional[str] = None
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
    thumbnailUrl: Optional[str] = None


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
    anchorRevisionLivesRemaining: int = 3
    readyForSubmission: bool = False
    images: list[MirageAnchorImageItem] = Field(default_factory=list)


class MirageAnchorUserItem(BaseModel):
    userId: str
    username: Optional[str] = None
    name: Optional[str] = None
    consentEnabled: bool = False
    enrollmentStatus: str = "draft"
    approvedAnchorCount: int = 0
    requiredAnchorCount: int = 6
    pendingAnchorCount: int = 0
    processingAnchorCount: int = 0
    rejectedAnchorCount: int = 0
    totalActiveImageCount: int = 0
    readyForMapping: bool = False
    lastProcessedAt: Optional[str] = None
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
    galleryVisibility: str = "draft"
    batchState: str = "idle"
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
    processedVerifiedUserCount: int = 0
    totalVerifiedUserCount: int = 0
    stagedMappingCount: int = 0
    publishedMappingCount: int = 0
    assetState: str = "idle"
    assetStats: dict = Field(default_factory=dict)
    optimizedImageCount: int = 0
    failedOptimizedImageCount: int = 0
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
    detectedFaceCount: int = 0
    mappedUserCount: int = 0
    assetStatus: str = "pending"
    assetError: Optional[str] = None
    thumbUrl: Optional[str] = None
    previewUrl: Optional[str] = None
    inferenceUrl: Optional[str] = None
    hasLocalInferenceCache: bool = False
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
    galleryVisibility: str = "draft"
    batchState: str = "idle"
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
    processedVerifiedUserCount: int = 0
    totalVerifiedUserCount: int = 0
    stagedMappingCount: int = 0
    publishedMappingCount: int = 0
    assetState: str = "idle"
    assetStats: dict = Field(default_factory=dict)
    optimizedImageCount: int = 0
    failedOptimizedImageCount: int = 0
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


class MirageSearchPersonItem(BaseModel):
    userId: str
    name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    photoCount: int = 0
    coverPhoto: Optional[MiragePhotoItem] = None
    latestPhotoAt: Optional[str] = None


class MirageSearchPeopleResponse(BaseModel):
    query: str
    people: list[MirageSearchPersonItem] = Field(default_factory=list)


class MirageSearchPersonDetailResponse(BaseModel):
    participant: MirageSearchPersonItem
    photos: list[MiragePhotoItem] = Field(default_factory=list)


class MirageMomentParticipantItem(BaseModel):
    userId: str
    name: Optional[str] = None
    username: Optional[str] = None


class MirageMomentImageItem(BaseModel):
    imageId: str
    displayOrder: int
    storagePath: str
    filename: str
    mimeType: str
    isCover: bool = False
    imageUrl: Optional[str] = None
    thumbnailUrl: Optional[str] = None
    slideTitle: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    participants: list[MirageMomentParticipantItem] = Field(default_factory=list)


class MirageMomentResponse(BaseModel):
    momentId: str
    title: str
    subtitle: Optional[str] = None
    dayLabel: str
    status: Literal["draft", "published", "unpublished"] = "draft"
    publishedAt: Optional[str] = None
    images: list[MirageMomentImageItem] = Field(default_factory=list)


class MirageMomentAdminResponse(MirageMomentResponse):
    createdByAdminId: Optional[int] = None
    updatedByAdminId: Optional[int] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class MirageMomentCreateRequest(BaseModel):
    """Create a Mirage Moment (always starts as draft)."""

    title: str
    subtitle: Optional[str] = None
    dayLabel: Optional[str] = None

    @field_validator("title")
    @classmethod
    def _reject_blank_title(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("must not be blank")
        return value.strip()

    @field_validator("subtitle", "dayLabel", mode="before")
    @classmethod
    def _trim_optional_strings(cls, value):
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        return stripped or None


class MirageMomentPatchRequest(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    dayLabel: Optional[str] = None

    @field_validator("title")
    @classmethod
    def _patch_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise TypeError("string required")
        stripped = value.strip()
        if not stripped:
            raise ValueError("title must not be blank when provided")
        return stripped

    @field_validator("subtitle", mode="before")
    @classmethod
    def _patch_subtitle(cls, value):  # clear with null or blanks
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        return stripped or None

    @field_validator("dayLabel")
    @classmethod
    def _patch_day_label(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise TypeError("string required")
        stripped = value.strip()
        if not stripped:
            raise ValueError("dayLabel must not be blank when provided")
        return stripped


class MirageMomentImagePatchRequest(BaseModel):
    slideTitle: Optional[str] = None
    displayOrder: Optional[int] = Field(default=None, ge=1)
    isCover: Optional[bool] = None

    @field_validator("slideTitle")
    @classmethod
    def _trim_slide(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        return stripped or None


class MirageMomentImageParticipantsRequest(BaseModel):
    participantUserIds: list[str] = Field(default_factory=list)

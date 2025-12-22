/**
 * Photo gRPC Handlers - Story 3.2
 * 
 * SITUATION: Gateway calls catalog-service via gRPC for photo operations
 * TASK: Implement gRPC service handlers that delegate to PhotoService
 * ACTION: Map gRPC requests to service calls, handle errors
 * RESULT: Clean gRPC interface for photo operations
 * 
 * @module PhotoGrpcHandlers
 */

import { ServerUnaryCall, sendUnaryData, status } from '@grpc/grpc-js';
import { photoService, PhotoNotFoundError, PhotoAccessDeniedError, ListingNotFoundError, ListingAccessDeniedError } from '../../services/photo-service';
import type { Logger } from 'pino';

// ============================================================================
// Request/Response Types (from proto)
// ============================================================================

interface PresignedUrlRequest {
    farmerId: number;
    listingId: number;
    fileName: string;
    contentType: string;
}

interface PresignedUrlResponse {
    photoId: number;
    presignedUrl: string;
    s3Key: string;
    expiresIn: number;
}

interface ConfirmUploadRequest {
    farmerId: number;
    photoId: number;
    listingId: number;
    fileSizeBytes: number;
    originalSizeBytes: number;
    width: number;
    height: number;
    latitude: number;
    longitude: number;
    deviceModel: string;
}

interface PhotoResponse {
    id: number;
    listingId: number;
    photoUrl: string;
    thumbnailUrl: string;
    originalFilename: string;
    contentType: string;
    fileSizeBytes: number;
    width: number;
    height: number;
    qualityScore: number;
    validationStatus: string;
    validationMessage: string;
    isPrimary: boolean;
    createdAt: string;
}

interface GetPhotosRequest {
    farmerId: number;
    listingId: number;
}

interface PhotosResponse {
    photos: PhotoResponse[];
}

interface DeletePhotoRequest {
    farmerId: number;
    photoId: number;
    listingId: number;
}

interface StatusResponse {
    success: boolean;
    message: string;
}

interface UpdateValidationRequest {
    photoId: number;
    isValid: boolean;
    qualityScore: number;
    issues: Array<{ type: string; message: string; suggestion: string }>;
}

// ============================================================================
// Handler Factory
// ============================================================================

export function photoGrpcHandlers(logger: Logger) {
    return {
        /**
         * GetPresignedUrl - Generate presigned URL for photo upload
         */
        GetPresignedUrl(
            call: ServerUnaryCall<PresignedUrlRequest, PresignedUrlResponse>,
            callback: sendUnaryData<PresignedUrlResponse>
        ): void {
            const req = call.request;

            photoService.generatePresignedUrl(req.farmerId, {
                listingId: req.listingId,
                fileName: req.fileName,
                contentType: req.contentType,
            })
                .then((result) => {
                    callback(null, {
                        photoId: result.photoId,
                        presignedUrl: result.presignedUrl,
                        s3Key: result.s3Key,
                        expiresIn: result.expiresIn,
                    });
                })
                .catch((error) => {
                    callback(toGrpcError(error), null);
                });
        },

        /**
         * ConfirmPhotoUpload - Confirm upload after client uploads to S3
         */
        ConfirmPhotoUpload(
            call: ServerUnaryCall<ConfirmUploadRequest, PhotoResponse>,
            callback: sendUnaryData<PhotoResponse>
        ): void {
            const req = call.request;

            photoService.confirmUpload(req.farmerId, {
                photoId: req.photoId,
                listingId: req.listingId,
                fileSizeBytes: req.fileSizeBytes || undefined,
                originalSizeBytes: req.originalSizeBytes || undefined,
                width: req.width || undefined,
                height: req.height || undefined,
                latitude: req.latitude || undefined,
                longitude: req.longitude || undefined,
                deviceModel: req.deviceModel || undefined,
            })
                .then((photo) => {
                    callback(null, toGrpcPhoto(photo));
                })
                .catch((error) => {
                    callback(toGrpcError(error), null);
                });
        },

        /**
         * GetListingPhotos - Get all photos for a listing
         */
        GetListingPhotos(
            call: ServerUnaryCall<GetPhotosRequest, PhotosResponse>,
            callback: sendUnaryData<PhotosResponse>
        ): void {
            const req = call.request;

            photoService.getPhotosForListing(req.farmerId, req.listingId)
                .then((photos) => {
                    callback(null, {
                        photos: photos.map(toGrpcPhoto),
                    });
                })
                .catch((error) => {
                    callback(toGrpcError(error), null);
                });
        },

        /**
         * DeletePhoto - Delete a photo
         */
        DeletePhoto(
            call: ServerUnaryCall<DeletePhotoRequest, StatusResponse>,
            callback: sendUnaryData<StatusResponse>
        ): void {
            const req = call.request;

            photoService.deletePhoto(req.farmerId, req.photoId, req.listingId)
                .then(() => {
                    callback(null, { success: true, message: 'Photo deleted' });
                })
                .catch((error) => {
                    callback(toGrpcError(error), null);
                });
        },

        /**
         * UpdatePhotoValidation - Update validation status (called by AI service)
         */
        UpdatePhotoValidation(
            call: ServerUnaryCall<UpdateValidationRequest, PhotoResponse>,
            callback: sendUnaryData<PhotoResponse>
        ): void {
            const req = call.request;

            photoService.updateValidation(req.photoId, {
                isValid: req.isValid,
                qualityScore: req.qualityScore,
                issues: req.issues.map(i => ({
                    type: i.type as any,
                    message: i.message,
                    suggestion: i.suggestion,
                })),
            })
                .then((photo) => {
                    callback(null, toGrpcPhoto(photo));
                })
                .catch((error) => {
                    callback(toGrpcError(error), null);
                });
        },
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

function toGrpcPhoto(photo: any): PhotoResponse {
    return {
        id: photo.id,
        listingId: photo.listingId,
        photoUrl: photo.photoUrl || '',
        thumbnailUrl: photo.thumbnailUrl || '',
        originalFilename: photo.originalFilename || '',
        contentType: photo.contentType || 'image/jpeg',
        fileSizeBytes: photo.fileSizeBytes || 0,
        width: photo.width || 0,
        height: photo.height || 0,
        qualityScore: photo.qualityScore || 0,
        validationStatus: photo.validationStatus || 'PENDING',
        validationMessage: photo.validationMessage || '',
        isPrimary: photo.isPrimary || false,
        createdAt: photo.createdAt || new Date().toISOString(),
    };
}

function toGrpcError(error: any): any {
    if (error instanceof PhotoNotFoundError || error instanceof ListingNotFoundError) {
        return {
            code: status.NOT_FOUND,
            details: error.message,
        };
    }
    if (error instanceof PhotoAccessDeniedError || error instanceof ListingAccessDeniedError) {
        return {
            code: status.PERMISSION_DENIED,
            details: error.message,
        };
    }
    return {
        code: status.INTERNAL,
        details: error.message || 'Internal server error',
    };
}

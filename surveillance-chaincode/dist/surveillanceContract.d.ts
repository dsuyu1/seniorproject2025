import { Context, Contract } from 'fabric-contract-api';
export interface CameraDevice {
    docType?: string;
    deviceID: string;
    publicKey: string;
    registeredBy: string;
    registrationTime: string;
    location?: string;
    model?: string;
    status: 'active' | 'inactive' | 'revoked';
}
export interface AccessLog {
    docType?: string;
    logID: string;
    cameraID: string;
    accessorID: string;
    timestamp: string;
    action: string;
    approved: boolean;
}
export interface VideoContent {
    docType?: string;
    contentID: string;
    ipfsCID: string;
    cameraID: string;
    timestamp: string;
    duration: number;
    encryptionKeyHash: string;
    metadata?: {
        resolution?: string;
        fps?: number;
        faces_detected?: number;
        faces_blurred?: number;
    };
}
export declare class SurveillanceContract extends Contract {
    InitLedger(ctx: Context): Promise<void>;
    RegisterCamera(ctx: Context, deviceID: string, publicKey: string, location: string, model: string): Promise<void>;
    ReadCamera(ctx: Context, deviceID: string): Promise<CameraDevice>;
    UpdateCameraStatus(ctx: Context, deviceID: string, newStatus: 'active' | 'inactive' | 'revoked'): Promise<void>;
    LogAccess(ctx: Context, cameraID: string, accessorID: string, action: string): Promise<void>;
    AnchorVideoContent(ctx: Context, contentID: string, ipfsCID: string, cameraID: string, duration: string, encryptionKeyHash: string, metadataJSON: string): Promise<void>;
    ReadVideoContent(ctx: Context, contentID: string): Promise<VideoContent>;
    GetCameraVideos(ctx: Context, cameraID: string): Promise<string>;
    GetAllCameras(ctx: Context): Promise<string>;
    GetCameraAccessLogs(ctx: Context, cameraID: string): Promise<string>;
    CameraExists(ctx: Context, deviceID: string): Promise<boolean>;
    DeleteCamera(ctx: Context, deviceID: string): Promise<void>;
}
//# sourceMappingURL=surveillanceContract.d.ts.map
import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api';
import stringify from 'json-stringify-deterministic';
import sortKeysRecursive from 'sort-keys-recursive';

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

// NEW: Video content interface
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

@Info({title: 'SurveillanceContract', description: 'Zero-Trust Camera Identity Management'})
export class SurveillanceContract extends Contract {

    @Transaction()
    public async InitLedger(ctx: Context): Promise<void> {
        console.info('============= START : Initialize Ledger ===========');
        const cameras: CameraDevice[] = [
            {
                docType: 'camera',
                deviceID: 'RPI5-TEST-001',
                publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...',
                registeredBy: 'Org1MSP',
                registrationTime: new Date().toISOString(),
                location: 'UTRGV Lab Room',
                model: 'Raspberry Pi 5',
                status: 'active',
            },
        ];

        for (const camera of cameras) {
            await ctx.stub.putState(camera.deviceID, Buffer.from(stringify(sortKeysRecursive(camera))));
            console.info(`Camera ${camera.deviceID} initialized`);
        }
        console.info('============= END : Initialize Ledger ===========');
    }

    @Transaction()
    public async RegisterCamera(ctx: Context, deviceID: string, publicKey: string, location: string, model: string): Promise<void> {
        console.info(`============= START : Register Camera ${deviceID} ===========`);
        const exists = await this.CameraExists(ctx, deviceID);
        if (exists) {
            throw new Error(`Camera ${deviceID} already exists`);
        }

        const mspID = ctx.clientIdentity.getMSPID();
        const camera: CameraDevice = {
            docType: 'camera',
            deviceID: deviceID,
            publicKey: publicKey,
            registeredBy: mspID,
            registrationTime: new Date().toISOString(),
            location: location,
            model: model,
            status: 'active',
        };

        await ctx.stub.putState(deviceID, Buffer.from(stringify(sortKeysRecursive(camera))));
        console.info(`============= END : Register Camera ${deviceID} ===========`);
    }

    @Transaction(false)
    @Returns('CameraDevice')
    public async ReadCamera(ctx: Context, deviceID: string): Promise<CameraDevice> {
        const cameraJSON = await ctx.stub.getState(deviceID);
        if (!cameraJSON || cameraJSON.length === 0) {
            throw new Error(`Camera ${deviceID} does not exist`);
        }
        return JSON.parse(cameraJSON.toString());
    }

    @Transaction()
    public async UpdateCameraStatus(ctx: Context, deviceID: string, newStatus: 'active' | 'inactive' | 'revoked'): Promise<void> {
        console.info(`============= START : Update Camera Status ${deviceID} ===========`);
        const camera = await this.ReadCamera(ctx, deviceID);
        camera.status = newStatus;
        await ctx.stub.putState(deviceID, Buffer.from(stringify(sortKeysRecursive(camera))));
        console.info(`Camera ${deviceID} status updated to ${newStatus}`);
    }

    @Transaction()
    public async LogAccess(ctx: Context, cameraID: string, accessorID: string, action: string): Promise<void> {
        const camera = await this.ReadCamera(ctx, cameraID);
        if (camera.status !== 'active') {
            throw new Error(`Access denied: Camera ${cameraID} status is ${camera.status}`);
        }

        const timestamp = new Date().toISOString();
        const logID = `LOG-${cameraID}-${Date.now()}`;
        
        const accessLog: AccessLog = {
            docType: 'accesslog',
            logID: logID,
            cameraID: cameraID,
            accessorID: accessorID,
            timestamp: timestamp,
            action: action,
            approved: true,
        };

        await ctx.stub.putState(logID, Buffer.from(stringify(sortKeysRecursive(accessLog))));
        console.info(`Access logged: ${accessorID} performed ${action} on ${cameraID}`);
    }

    // NEW: Anchor video content
    @Transaction()
    public async AnchorVideoContent(
        ctx: Context,
        contentID: string,
        ipfsCID: string,
        cameraID: string,
        duration: string,
        encryptionKeyHash: string,
        metadataJSON: string
    ): Promise<void> {
        console.info(`============= START : Anchor Video ${contentID} ===========`);

        const camera = await this.ReadCamera(ctx, cameraID);
        if (camera.status !== 'active') {
            throw new Error(`Camera ${cameraID} is not active`);
        }

        let metadata = {};
        if (metadataJSON && metadataJSON !== '{}') {
            try {
                metadata = JSON.parse(metadataJSON);
            } catch (e) {
                console.warn('Invalid metadata JSON');
            }
        }

        const videoContent: VideoContent = {
            docType: 'videocontent',
            contentID: contentID,
            ipfsCID: ipfsCID,
            cameraID: cameraID,
            timestamp: new Date().toISOString(),
            duration: parseFloat(duration),
            encryptionKeyHash: encryptionKeyHash,
            metadata: metadata,
        };

        await ctx.stub.putState(contentID, Buffer.from(stringify(sortKeysRecursive(videoContent))));
        console.info(`Video ${contentID} anchored with CID ${ipfsCID}`);
    }

    @Transaction(false)
    @Returns('VideoContent')
    public async ReadVideoContent(ctx: Context, contentID: string): Promise<VideoContent> {
        const contentJSON = await ctx.stub.getState(contentID);
        if (!contentJSON || contentJSON.length === 0) {
            throw new Error(`Video content ${contentID} does not exist`);
        }
        return JSON.parse(contentJSON.toString());
    }

    @Transaction(false)
    @Returns('string')
    public async GetCameraVideos(ctx: Context, cameraID: string): Promise<string> {
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
                if (record.docType === 'videocontent' && record.cameraID === cameraID) {
                    allResults.push(record);
                }
            } catch (err) {
                console.log(err);
            }
            result = await iterator.next();
        }
        
        return JSON.stringify(allResults);
    }

    @Transaction(false)
    @Returns('string')
    public async GetAllCameras(ctx: Context): Promise<string> {
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
                if (record.docType === 'camera') {
                    allResults.push(record);
                }
            } catch (err) {
                console.log(err);
            }
            result = await iterator.next();
        }
        
        return JSON.stringify(allResults);
    }

    @Transaction(false)
    @Returns('string')
    public async GetCameraAccessLogs(ctx: Context, cameraID: string): Promise<string> {
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
                if (record.docType === 'accesslog' && record.cameraID === cameraID) {
                    allResults.push(record);
                }
            } catch (err) {
                console.log(err);
            }
            result = await iterator.next();
        }
        
        return JSON.stringify(allResults);
    }

    @Transaction(false)
    public async CameraExists(ctx: Context, deviceID: string): Promise<boolean> {
        const cameraJSON = await ctx.stub.getState(deviceID);
        return cameraJSON && cameraJSON.length > 0;
    }

    @Transaction()
    public async DeleteCamera(ctx: Context, deviceID: string): Promise<void> {
        const exists = await this.CameraExists(ctx, deviceID);
        if (!exists) {
            throw new Error(`Camera ${deviceID} does not exist`);
        }
        await ctx.stub.deleteState(deviceID);
        console.info(`Camera ${deviceID} deleted from ledger`);
    }
}

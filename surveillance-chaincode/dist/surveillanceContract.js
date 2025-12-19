"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurveillanceContract = void 0;
const fabric_contract_api_1 = require("fabric-contract-api");
const json_stringify_deterministic_1 = __importDefault(require("json-stringify-deterministic"));
const sort_keys_recursive_1 = __importDefault(require("sort-keys-recursive"));
let SurveillanceContract = class SurveillanceContract extends fabric_contract_api_1.Contract {
    async InitLedger(ctx) {
        console.info('============= START : Initialize Ledger ===========');
        const cameras = [
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
            await ctx.stub.putState(camera.deviceID, Buffer.from((0, json_stringify_deterministic_1.default)((0, sort_keys_recursive_1.default)(camera))));
            console.info(`Camera ${camera.deviceID} initialized`);
        }
        console.info('============= END : Initialize Ledger ===========');
    }
    async RegisterCamera(ctx, deviceID, publicKey, location, model) {
        console.info(`============= START : Register Camera ${deviceID} ===========`);
        const exists = await this.CameraExists(ctx, deviceID);
        if (exists) {
            throw new Error(`Camera ${deviceID} already exists`);
        }
        const mspID = ctx.clientIdentity.getMSPID();
        const camera = {
            docType: 'camera',
            deviceID: deviceID,
            publicKey: publicKey,
            registeredBy: mspID,
            registrationTime: new Date().toISOString(),
            location: location,
            model: model,
            status: 'active',
        };
        await ctx.stub.putState(deviceID, Buffer.from((0, json_stringify_deterministic_1.default)((0, sort_keys_recursive_1.default)(camera))));
        console.info(`============= END : Register Camera ${deviceID} ===========`);
    }
    async ReadCamera(ctx, deviceID) {
        const cameraJSON = await ctx.stub.getState(deviceID);
        if (!cameraJSON || cameraJSON.length === 0) {
            throw new Error(`Camera ${deviceID} does not exist`);
        }
        return JSON.parse(cameraJSON.toString());
    }
    async UpdateCameraStatus(ctx, deviceID, newStatus) {
        console.info(`============= START : Update Camera Status ${deviceID} ===========`);
        const camera = await this.ReadCamera(ctx, deviceID);
        camera.status = newStatus;
        await ctx.stub.putState(deviceID, Buffer.from((0, json_stringify_deterministic_1.default)((0, sort_keys_recursive_1.default)(camera))));
        console.info(`Camera ${deviceID} status updated to ${newStatus}`);
    }
    async LogAccess(ctx, cameraID, accessorID, action) {
        const camera = await this.ReadCamera(ctx, cameraID);
        if (camera.status !== 'active') {
            throw new Error(`Access denied: Camera ${cameraID} status is ${camera.status}`);
        }
        const timestamp = new Date().toISOString();
        const logID = `LOG-${cameraID}-${Date.now()}`;
        const accessLog = {
            docType: 'accesslog',
            logID: logID,
            cameraID: cameraID,
            accessorID: accessorID,
            timestamp: timestamp,
            action: action,
            approved: true,
        };
        await ctx.stub.putState(logID, Buffer.from((0, json_stringify_deterministic_1.default)((0, sort_keys_recursive_1.default)(accessLog))));
        console.info(`Access logged: ${accessorID} performed ${action} on ${cameraID}`);
    }
    // NEW: Anchor video content
    async AnchorVideoContent(ctx, contentID, ipfsCID, cameraID, duration, encryptionKeyHash, metadataJSON) {
        console.info(`============= START : Anchor Video ${contentID} ===========`);
        const camera = await this.ReadCamera(ctx, cameraID);
        if (camera.status !== 'active') {
            throw new Error(`Camera ${cameraID} is not active`);
        }
        let metadata = {};
        if (metadataJSON && metadataJSON !== '{}') {
            try {
                metadata = JSON.parse(metadataJSON);
            }
            catch (e) {
                console.warn('Invalid metadata JSON');
            }
        }
        const videoContent = {
            docType: 'videocontent',
            contentID: contentID,
            ipfsCID: ipfsCID,
            cameraID: cameraID,
            timestamp: new Date().toISOString(),
            duration: parseFloat(duration),
            encryptionKeyHash: encryptionKeyHash,
            metadata: metadata,
        };
        await ctx.stub.putState(contentID, Buffer.from((0, json_stringify_deterministic_1.default)((0, sort_keys_recursive_1.default)(videoContent))));
        console.info(`Video ${contentID} anchored with CID ${ipfsCID}`);
    }
    async ReadVideoContent(ctx, contentID) {
        const contentJSON = await ctx.stub.getState(contentID);
        if (!contentJSON || contentJSON.length === 0) {
            throw new Error(`Video content ${contentID} does not exist`);
        }
        return JSON.parse(contentJSON.toString());
    }
    async GetCameraVideos(ctx, cameraID) {
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
            }
            catch (err) {
                console.log(err);
            }
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }
    async GetAllCameras(ctx) {
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
            }
            catch (err) {
                console.log(err);
            }
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }
    async GetCameraAccessLogs(ctx, cameraID) {
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
            }
            catch (err) {
                console.log(err);
            }
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }
    async CameraExists(ctx, deviceID) {
        const cameraJSON = await ctx.stub.getState(deviceID);
        return cameraJSON && cameraJSON.length > 0;
    }
    async DeleteCamera(ctx, deviceID) {
        const exists = await this.CameraExists(ctx, deviceID);
        if (!exists) {
            throw new Error(`Camera ${deviceID} does not exist`);
        }
        await ctx.stub.deleteState(deviceID);
        console.info(`Camera ${deviceID} deleted from ledger`);
    }
};
__decorate([
    (0, fabric_contract_api_1.Transaction)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context]),
    __metadata("design:returntype", Promise)
], SurveillanceContract.prototype, "InitLedger", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context, String, String, String, String]),
    __metadata("design:returntype", Promise)
], SurveillanceContract.prototype, "RegisterCamera", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('CameraDevice'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context, String]),
    __metadata("design:returntype", Promise)
], SurveillanceContract.prototype, "ReadCamera", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context, String, String]),
    __metadata("design:returntype", Promise)
], SurveillanceContract.prototype, "UpdateCameraStatus", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context, String, String, String]),
    __metadata("design:returntype", Promise)
], SurveillanceContract.prototype, "LogAccess", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], SurveillanceContract.prototype, "AnchorVideoContent", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('VideoContent'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context, String]),
    __metadata("design:returntype", Promise)
], SurveillanceContract.prototype, "ReadVideoContent", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context, String]),
    __metadata("design:returntype", Promise)
], SurveillanceContract.prototype, "GetCameraVideos", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context]),
    __metadata("design:returntype", Promise)
], SurveillanceContract.prototype, "GetAllCameras", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context, String]),
    __metadata("design:returntype", Promise)
], SurveillanceContract.prototype, "GetCameraAccessLogs", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context, String]),
    __metadata("design:returntype", Promise)
], SurveillanceContract.prototype, "CameraExists", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context, String]),
    __metadata("design:returntype", Promise)
], SurveillanceContract.prototype, "DeleteCamera", null);
SurveillanceContract = __decorate([
    (0, fabric_contract_api_1.Info)({ title: 'SurveillanceContract', description: 'Zero-Trust Camera Identity Management' })
], SurveillanceContract);
exports.SurveillanceContract = SurveillanceContract;
//# sourceMappingURL=surveillanceContract.js.map
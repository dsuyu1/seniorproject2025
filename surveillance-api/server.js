const express = require('express');
const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// Load connection profile
const connectionProfilePath = path.resolve(__dirname, 'connection-profile.yaml');
const connectionProfile = yaml.load(fs.readFileSync(connectionProfilePath, 'utf8'));

// Wallet path
const walletPath = path.join(__dirname, 'wallet');
let wallet;

// Initialize wallet
async function initWallet() {
    wallet = await Wallets.newFileSystemWallet(walletPath);
    console.log(`✅ Wallet initialized at: ${walletPath}`);
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Surveillance API is running' });
});

// Register camera
app.post('/api/cameras/register', async (req, res) => {
    try {
        const { deviceID, publicKey, location, model } = req.body;

        const gateway = new Gateway();
        await gateway.connect(connectionProfile, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: false }
        });

        const network = await gateway.getNetwork('surveillance');
        const contract = network.getContract('surveillance');

        await contract.submitTransaction('RegisterCamera', deviceID, publicKey, location, model);

        await gateway.disconnect();

        res.json({
            success: true,
            message: 'Camera registered successfully',
            deviceID
        });

    } catch (error) {
        console.error('Error registering camera:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all cameras
app.get('/api/cameras', async (req, res) => {
    try {
        const gateway = new Gateway();
        await gateway.connect(connectionProfile, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: false }
        });

        const network = await gateway.getNetwork('surveillance');
        const contract = network.getContract('surveillance');

        const result = await contract.evaluateTransaction('GetAllCameras');
        const cameras = JSON.parse(result.toString());

        await gateway.disconnect();

        res.json(cameras);

    } catch (error) {
        console.error('Error getting cameras:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get specific camera
app.get('/api/cameras/:deviceID', async (req, res) => {
    try {
        const { deviceID } = req.params;

        const gateway = new Gateway();
        await gateway.connect(connectionProfile, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: false }
        });

        const network = await gateway.getNetwork('surveillance');
        const contract = network.getContract('surveillance');

        const result = await contract.evaluateTransaction('ReadCamera', deviceID);
        const camera = JSON.parse(result.toString());

        await gateway.disconnect();

        res.json(camera);

    } catch (error) {
        console.error('Error getting camera:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update camera status
app.put('/api/cameras/:deviceID/status', async (req, res) => {
    try {
        const { deviceID } = req.params;
        const { status } = req.body;

        const gateway = new Gateway();
        await gateway.connect(connectionProfile, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: false }
        });

        const network = await gateway.getNetwork('surveillance');
        const contract = network.getContract('surveillance');

        await contract.submitTransaction('UpdateCameraStatus', deviceID, status);

        await gateway.disconnect();

        res.json({
            success: true,
            message: 'Camera status updated',
            deviceID,
            status
        });

    } catch (error) {
        console.error('Error updating camera status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Log access event
app.post('/api/cameras/:deviceID/access-log', async (req, res) => {
    try {
        const { deviceID } = req.params;
        const { accessorID, action } = req.body;

        const gateway = new Gateway();
        await gateway.connect(connectionProfile, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: false }
        });

        const network = await gateway.getNetwork('surveillance');
        const contract = network.getContract('surveillance');

        await contract.submitTransaction('LogAccess', deviceID, accessorID, action);

        await gateway.disconnect();

        res.json({
            success: true,
            message: 'Access logged successfully'
        });

    } catch (error) {
        console.error('Error logging access:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get access logs for camera
app.get('/api/cameras/:deviceID/access-logs', async (req, res) => {
    try {
        const { deviceID } = req.params;

        const gateway = new Gateway();
        await gateway.connect(connectionProfile, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: false }
        });

        const network = await gateway.getNetwork('surveillance');
        const contract = network.getContract('surveillance');

        const result = await contract.evaluateTransaction('GetCameraAccessLogs', deviceID);
        const logs = JSON.parse(result.toString());

        await gateway.disconnect();

        res.json(logs);

    } catch (error) {
        console.error('Error getting access logs:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== VIDEO CONTENT ENDPOINTS ====================

// Anchor video content on blockchain
app.post('/api/videos/anchor', async (req, res) => {
    try {
        const { contentID, ipfsCID, cameraID, duration, encryptionKeyHash, metadata } = req.body;

        console.log('📝 Anchoring video content:', {
            contentID,
            ipfsCID,
            cameraID,
            duration,
            encryptionKeyHash,
            metadata
        });

        const gateway = new Gateway();
        await gateway.connect(connectionProfile, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: false }
        });

        const network = await gateway.getNetwork('surveillance');
        const contract = network.getContract('surveillance');

        // Convert metadata to JSON string
        const metadataJSON = metadata ? JSON.stringify(metadata) : '{}';

        await contract.submitTransaction(
            'AnchorVideoContent',
            contentID,
            ipfsCID,
            cameraID,
            duration.toString(),
            encryptionKeyHash,
            metadataJSON
        );

        await gateway.disconnect();

        console.log('✅ Video content anchored successfully');

        res.json({
            success: true,
            message: 'Video content anchored successfully',
            contentID,
            ipfsCID
        });

    } catch (error) {
        console.error('❌ Error anchoring video:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get video content details
app.get('/api/videos/:contentID', async (req, res) => {
    try {
        const { contentID } = req.params;

        const gateway = new Gateway();
        await gateway.connect(connectionProfile, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: false }
        });

        const network = await gateway.getNetwork('surveillance');
        const contract = network.getContract('surveillance');

        const result = await contract.evaluateTransaction('ReadVideoContent', contentID);
        const videoContent = JSON.parse(result.toString());

        await gateway.disconnect();

        res.json(videoContent);

    } catch (error) {
        console.error('Error reading video content:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all videos for a camera
app.get('/api/cameras/:cameraID/videos', async (req, res) => {
    try {
        const { cameraID } = req.params;

        const gateway = new Gateway();
        await gateway.connect(connectionProfile, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: false }
        });

        const network = await gateway.getNetwork('surveillance');
        const contract = network.getContract('surveillance');

        const result = await contract.evaluateTransaction('GetCameraVideos', cameraID);
        const videos = JSON.parse(result.toString());

        await gateway.disconnect();

        res.json(videos);

    } catch (error) {
        console.error('Error getting camera videos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Legacy endpoint - submit footage (backwards compatibility)
app.post('/api/footage/submit', async (req, res) => {
    try {
        const { contentID, ipfsCID, cameraID, duration, encryptionKeyHash, metadata } = req.body;

        const gateway = new Gateway();
        await gateway.connect(connectionProfile, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: false }
        });

        const network = await gateway.getNetwork('surveillance');
        const contract = network.getContract('surveillance');

        const metadataJSON = metadata ? JSON.stringify(metadata) : '{}';

        await contract.submitTransaction(
            'AnchorVideoContent',
            contentID,
            ipfsCID,
            cameraID,
            duration.toString(),
            encryptionKeyHash || 'no-encryption',
            metadataJSON
        );

        await gateway.disconnect();

        res.json({
            success: true,
            message: 'Footage submitted successfully',
            contentID,
            ipfsCID
        });

    } catch (error) {
        console.error('Error submitting footage:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get footage for camera (backwards compatibility)
app.get('/api/footage/:cameraID', async (req, res) => {
    try {
        const { cameraID } = req.params;

        const gateway = new Gateway();
        await gateway.connect(connectionProfile, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: false }
        });

        const network = await gateway.getNetwork('surveillance');
        const contract = network.getContract('surveillance');

        const result = await contract.evaluateTransaction('GetCameraVideos', cameraID);
        const videos = JSON.parse(result.toString());

        await gateway.disconnect();

        res.json(videos);

    } catch (error) {
        console.error('Error getting footage:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
async function main() {
    await initWallet();
    
    app.listen(PORT, () => {
        console.log(`🚀 Surveillance API server running on port ${PORT}`);
        console.log(`📡 Health check: http://localhost:${PORT}/health`);
        console.log(`📹 Camera endpoints: http://localhost:${PORT}/api/cameras`);
        console.log(`🎥 Video endpoints: http://localhost:${PORT}/api/videos`);
    });
}

main().catch(console.error);

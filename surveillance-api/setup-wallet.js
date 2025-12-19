const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

async function main() {
    try {
        // Load org1msp credentials
        const credPath = path.join(__dirname, '..', 'resources', 'org1msp.yaml');
        console.log(`Reading credentials from: ${credPath}`);
        
        const credYaml = yaml.load(fs.readFileSync(credPath, 'utf8'));
        
        // Extract certificate and private key from the correct structure
        const cert = credYaml.cert.pem;
        const key = credYaml.key.pem;
        
        if (!cert || !key) {
            console.error('❌ Could not find certificate or private key');
            process.exit(1);
        }
        
        console.log('✓ Certificate found (length:', cert.length, 'bytes)');
        console.log('✓ Private key found (length:', key.length, 'bytes)');
        
        // Create wallet
        const walletPath = path.join(__dirname, 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        
        // Remove existing admin if present
        try {
            await wallet.remove('admin');
            console.log('🗑️  Removed existing admin identity');
        } catch (e) {
            // No existing identity, that's fine
        }
        
        // Create identity
        const identity = {
            credentials: {
                certificate: cert,
                privateKey: key,
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        
        await wallet.put('admin', identity);
        console.log('✅ Admin identity added to wallet successfully');
        
        // Verify the identity
        const savedIdentity = await wallet.get('admin');
        if (savedIdentity && savedIdentity.credentials.privateKey) {
            console.log('✅ Verified: Identity has certificate and private key');
            console.log('   MSP ID:', savedIdentity.mspId);
            console.log('   Type:', savedIdentity.type);
        } else {
            console.log('⚠️  Warning: Identity verification failed');
        }
        
        console.log('\n🎉 Wallet setup complete!');
        
    } catch (error) {
        console.error('❌ Failed to set up wallet:', error);
        process.exit(1);
    }
}

main();

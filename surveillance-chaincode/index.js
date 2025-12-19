'use strict';

const { Contract } = require('fabric-contract-api');

class SurveillanceContract extends Contract {

    async InitLedger(ctx) {
        console.info('Surveillance ledger initialized');
        return 'Ledger initialized successfully';
    }

    // Edge camera records surveillance event
    async RecordEvent(ctx, eventID, cameraID, timestamp, videoHash, metadataHash) {
        const clientID = ctx.clientIdentity.getID();
        
        const event = {
            eventID: eventID,
            cameraID: cameraID,
            timestamp: timestamp,
            videoHash: videoHash,
            metadataHash: metadataHash,
            owner: clientID,
            docType: 'event'
        };

        await ctx.stub.putState(eventID, Buffer.from(JSON.stringify(event)));
        await this.logAccess(ctx, eventID, clientID, 'CREATE');
        
        return JSON.stringify(event);
    }

    // Get surveillance event
    async GetEvent(ctx, eventID) {
        const eventJSON = await ctx.stub.getState(eventID);
        if (!eventJSON || eventJSON.length === 0) {
            throw new Error(`Event ${eventID} does not exist`);
        }

        const clientID = ctx.clientIdentity.getID();
        await this.logAccess(ctx, eventID, clientID, 'READ');

        return eventJSON.toString();
    }

    // Get all events
    async GetAllEvents(ctx) {
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
                if (record.docType === 'event') {
                    allResults.push(record);
                }
            } catch (err) {
                console.log(err);
            }
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }

    // Log access for audit trail
    async logAccess(ctx, eventID, accessedBy, action) {
        const txID = ctx.stub.getTxID();
        const timestamp = ctx.stub.getTxTimestamp();
        
        const accessLog = {
            logID: txID,
            eventID: eventID,
            accessedBy: accessedBy,
            timestamp: new Date(timestamp.seconds * 1000).toISOString(),
            action: action,
            docType: 'accessLog'
        };

        await ctx.stub.putState(`LOG_${txID}`, Buffer.from(JSON.stringify(accessLog)));
    }
}

module.exports = SurveillanceContract;

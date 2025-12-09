# Privacy-First Network Edge Device Dependencies
## Introduction
For our demonstration, we're using a Raspberry Pi 5. The camera will capture video, blur faces, encrypt, and send metadata to blockchain. 

### What Runs on Pi 5:
1. **Video capture** (from camera)
2. **Face blurring** (YOLOv11n @ 18 FPS)
3. **AES-256 encryption** (video stays encrypted)
4. **ZKP generation** (proves identity without revealing it)
5. **Fabric SDK client** (connects to Debian server's blockchain)
6. **Upload encrypted video to IPFS**
7. **Send metadata to blockchain** (via API or direct SDK)

These instructions will focus on the security aspect of the project. Assume YOLO has already been set up.



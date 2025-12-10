# Deploying the Privacy-First Network on Debian (Hyperledger Fabric, Kubernetes, Helm, Bevel, Vault, IPFS, API)
## Introduction
- **Hyperledger Fabric**: Hyperledger Fabric is an open-source enterprise-grade permissioned distributed ledger technology (DLT) platform, designed for use in enterprise contexts, that delivers some key differentiating capabilities over other popular distributed ledger or blockchain platforms.
- **Kubernetes**: Kubernetes is an open source container orchestration engine for automating deployment, scaling, and management of containerized applications. The open source project is hosted by the Cloud Native Computing Foundation (CNCF). 
- **Helm**: Package manager for Kubernetes. 
- **Bevel**: Hyperledger Bevel is a sophisticated automation framework designed for the deployment of production-ready Distributed Ledger Technology (DLT) networks across cloud infrastructures. (but we're doing cloud for now, so it just automates our DLT network).
- **Hashicorp Vault**: Vault provides organizations with identity-based security to automatically authenticate and authorize access to secrets and other sensitive data.

### What runs on the Debian server?

- 4 Organizations (Clients, PolicyAdmin, ServerAdmin, AuditServer)
- 8 Peers (2 per organization)
- 1 Orderer
- 4 Certificate Authorities
- Chaincode as a Service (CaaS)
- API Backend 
- IPFS node (for video storage)

---

## Hyperledger Debian Instance Details
| Property | Value |
|----------|-------|
| Name | hyperledger-debian |
| Instance ID | 6800883049016755902 |
| Description | None |
| Type | Instance |
| Status | Running |
| Creation Time | Dec 5, 2025, 1:53:54 PM UTC-06:00 |
| Location | us-central1-f |
| Boot Disk Source Image | debian-12-bookworm-v20251111 |
| Boot Disk Architecture | X86_64 |
| Boot Disk License Type | Free |
| Instance Template | None |
| In Use By | None |
| Physical Host | None |
| Maintenance Status | — |

### Labels

| Label | Value |
|-------|-------|
| goog-ec-src | vm_add-gcloud |
| goog-ops-a... | v2-x86-tem... |

### Protection & Configuration

| Property | Value |
|----------|-------|
| Tags | — |
| Deletion Protection | Disabled |
| Confidential VM Service | Disabled |
| Preserved State Size | 0 GB |
| Reservation Affinity | Automatically choose |
| Consumed Reservation | — |

### Machine Configuration

| Property | Value |
|----------|-------|
| Machine Type | c2d-standard-4 (4 vCPUs, 16 GB Memory) |
| CPU Platform | AMD Milan |
| Minimum CPU Platform | None |
| Architecture | x86/64 |
| vCPUs to Core Ratio | — |
| Custom Visible Cores | — |
| All-Core Turbo-Only Mode | — |
| Display Device | Disabled |
| GPUs | None |

### Networking

| Property | Value |
|----------|-------|
| Public DNS PTR Record | None |
| Total Egress Bandwidth Tier | — |
| HTTP Traffic | Off |
| HTTPS Traffic | Off |
| Allow Load Balancer Health Checks | Off |

### Resource Policies

(None specified)

## 0. Installing Requirements (x86_64)
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install minikube
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Install Go, the most current version may differ from this one
wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
# Remove previous Go installation, if applicable
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# Install Python3 and pip 
sudo apt install -y python3 python3-pip python3-venv

# Install git
sudo apt install -y git

# Install build tools for Go modules
sudo apt install -y build-essential

# Start minikube
# you might need to allocate less memory if your computer has less than 8GB
minikube start --memory=8192 --cpus=4 --driver=docker
```

## 1 Minikube
### 1.1 Start Minikube
```bash
# Start minikube with enough resources for Hyperledger Fabric
minikube start --memory=8192 --cpus=4 --disk-size=20g
```
### 1.2 Verify Minikube is working
You should see an output like so:
```bash
penguinpal88@hyperledger-debian:~$ minikube start --memory=8192 --cpus=4 --disk-size=20g
😄  minikube v1.37.0 on Debian 12.12 (amd64)
✨  Using the docker driver based on existing profile
❗  You cannot change the disk size for an existing minikube cluster. Please first delete the cluster.
👍  Starting "minikube" primary control-plane node in "minikube" cluster
🚜  Pulling base image v0.0.48 ...
🏃  Updating the running docker "minikube" container ...
🐳  Preparing Kubernetes v1.34.0 on Docker 28.4.0 ...
🔎  Verifying Kubernetes components...
    ▪ Using image gcr.io/k8s-minikube/storage-provisioner:v5
🌟  Enabled addons: storage-provisioner, default-storageclass
🏄  Done! kubectl is now configured to use "minikube" cluster and "default" namespace by default
```
You can run the following commands to verify further.
```bash
penguinpal88@hyperledger-debian:~$ minikube status
minikube
type: Control Plane
host: Running
kubelet: Running
apiserver: Running
kubeconfig: Configured

penguinpal88@hyperledger-debian:~$ kubectl cluster-info
Kubernetes control plane is running at https://192.168.49.2:8443
CoreDNS is running at https://192.168.49.2:8443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy

To further debug and diagnose cluster problems, use 'kubectl cluster-info dump'.
penguinpal88@hyperledger-debian:~$ kubectl get nodes
NAME       STATUS   ROLES           AGE     VERSION
minikube   Ready    control-plane   2d21h   v1.34.0
```

## 2. Make Project Directory
```bash
# If you have old project directory, remove it to start off clean
rm -rf ~/fabric-video-privacy

# Create fresh project structure
mkdir -p ~/fabric-video-privacy
cd ~/fabric-video-privacy
```

## 3. Setting up Hyperledger Bevel
### 3.1 Clone Hyperledger Bevel

```bash
cd ~/fabric-video-privacy

# Clone Bevel
git clone https://github.com/hyperledger-bevel/bevel.git

# Verify it cloned successfully
ls -la bevel/
```

### 3.2 Setup Python Virtual Environment

```bash
cd ~/fabric-video-privacy

# Create virtual environment
python3 -m venv bevel-env

# Activate it
source bevel-env/bin/activate

# Your prompt should now show (bevel-env) at the beginning
# Verify Python is from the virtual environment
which python
```

### 3.3 Install Bevel Requirements
After you've created your virtual environment, install requirements for Bevel.

```bash
# Move to where the requirements are stored
cd ~/fabric-video-privacy/bevel/docs

(bevel-env) penguinpal88@hyperledger-debian:~/fabric-video-privacy/bevel/docs$ pip install -r pip-requirements.txt
Collecting mkdocs-material
  Downloading mkdocs_material-9.7.0-py3-none-any.whl (9.3 MB)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 9.3/9.3 MB 63.6 MB/s eta 0:00:00
Collecting mike
  Downloading mike-2.1.3-py3-none-any.whl (33 kB)
Collecting babel>=2.10
  Downloading babel-2.17.0-py3-none-any.whl (10.2 MB)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 10.2/10.2 MB 110.2 MB/s eta 0:00:00
Collecting backrefs>=5.7.post1
  Downloading backrefs-6.1-py311-none-any.whl (392 kB)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 392.9/392.9 kB 73.8 MB/s eta 0:00:00
Collecting colorama>=0.4
  Downloading colorama-0.4.6-py2.py3-none-any.whl (25 kB)
Collecting jinja2>=3.1
  Downloading jinja2-3.1.6-py3-none-any.whl (134 kB)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 134.9/134.9 kB 39.3 MB/s eta 0:00:00
...
```

## 4. Vault
### 4.1 Install Vault
```bash
# Add Hashicorp Helm repo
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update

# Install Vault
helm install vault hashicorp/vault \
  --namespace vault \
  --create-namespace \
  --set server.dataStorage.size=2Gi
```
You can read more on Vault [here](https://developer.hashicorp.com/vault/docs).

### 4.2 Initialize Vault
```bash
# Initialize and unseal Vault
kubectl exec -it vault-0 -n vault -- vault operator init

# Save the credentials it pops out!
```
You should see an output like this:

```bash
Vault initialized with 5 key shares and a key threshold of 3. Please securely
distribute the key shares printed above. When the Vault is re-sealed,
restarted, or stopped, you must supply at least 3 of these keys to unseal it
before it can start servicing requests.

Vault does not store the generated root key. Without at least 3 keys to
reconstruct the root key, Vault will remain permanently sealed!

It is possible to generate new unseal keys, provided you have a quorum of
existing unseal keys shares. See "vault operator rekey" for more information.  
```

Later, you can verify that the vault is unsealed/sealed if you want. We just initialized it and grabbed our keys so it's sealed; this command might come in handy later.
```bash
# Verify Vault is sealed
kubectl exec vault-0 -n vault -- vault status
```

Be sure to save these tokens: **you will need it.**

### 4.3 Unseal Vault
```bash
# Copy the unseal key and paste it here
kubectl exec vault-0 -n vault -- vault operator unseal <paste-key-here>
```
If you generated 5 keys, you'll need to use 3 to unlock the vault.

You should see an output like this: 
```bash
(bevel-env) penguinpal88@hyperledger-debian:~/fabric-video-privacy/bevel/docs$ kubectl exec vault-0 -n vault -- vault operator unseal <MY_KEY>
Key             Value
---             -----
Seal Type       shamir
Initialized     true
Sealed          false
Total Shares    1
Threshold       1
Version         1.20.4
Build Date      2025-09-23T13:22:38Z
Storage Type    file
Cluster Name    vault-cluster-83d99449
Cluster ID      ba035ae2-45c4-2f42-cfc4-66136a1cde19
HA Enabled      false
```

## 5. Setup Git Repository for Bevel
```bash
# Make the releases repo if you don't have it
mkdir ~/fabric-video-privacy/releases
cd ~/fabric-video-privacy/releases

# Initialize git
git init

# Configure git
git config user.email <EMAIL>
git config user.name <USER.NAME>

# Add remote
git remote add origin https://github.com/dsuyu1/seniorproject2025.git

# Create directory structure for Bevel
mkdir -p platforms/hyperledger-fabric/releases/dev
mkdir -p platforms/hyperledger-fabric/charts

# Create initial commit
touch .gitkeep
git add .
git commit -m "Initial Bevel structure"

# Verify
git remote -v
```

## 6. network.yaml
Hyperledger Bevel uses a `network.yaml` file to set up the Hyperledger Fabric network.

### 6.1 Create network.yaml
```bash
cd ~/fabric-video-privacy

# Create network.yaml, use vim if you're not a noob
nano network.yaml
```

I made a network.yaml file already. It has:
- All 4 organizations (Clients, PolicyAdmin, ServerAdmin, AuditServer)
- Complete consortium and channel definitions
- All 7 endorsement policies

You can find it in this repository under `security-framework/network.yaml`.

### 6.2 Editing network.yaml
There are some placeholder tokens in `network.yaml`; we need to replace them. Use `vim` or `nano`.

You can verify they've been replaced using this command:
```bash
# Check that tokens were replaced (should show your actual tokens)
grep "root_token:" network.yaml | head -1
grep "password:" network.yaml | head -1
```
Once you've replaced the placeholder keys, it's time to _finally_ deploy the Fabric network with Bevel.

## 7. Deploying Hyperledger Fabric
```bash
# Make sure you're in the bevel directory with venv activated. You should have already done this. If not, run it again and pray nothing broke.
cd ~/fabric-video-privacy/bevel
source ../bevel-env/bin/activate

# You should make sure ansible is installed before
pip install ansible

# Run Bevel deployment (this will take 15-30 minutes)
ansible-playbook platforms/shared/configuration/site.yaml \
  --extra-vars "@../network.yaml"
```

While it's running, you can monitor in another terminal:
```bash
# Open a new terminal and watch pods being created
watch kubectl get pods --all-namespaces
```

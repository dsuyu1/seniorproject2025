# Deploying the Privacy-First Network (Hyperledger, Kubernetes, Helm, Bevel, Vault)
## Hyperledger Debian Instance Details

### Basic Information

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

## Requirements
First, install requirements:

```console
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
minikube start --memory=8192 --cpus=4 --driver=docker
```


## 1. Start Minikube
```console
# Start minikube with enough resources for Hyperledger Fabric
minikube start --memory=8192 --cpus=4 --disk-size=20g
```
### 1.1 Verify Minikube is working
You should see an output like so:
```console
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
```console
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
```console
# If you have old project directory, remove it to start off clean
rm -rf ~/fabric-video-privacy

# Create fresh project structure
mkdir -p ~/fabric-video-privacy
cd ~/fabric-video-privacy
```

## 3. Clone Hyperledger Bevel
```console
cd ~/fabric-video-privacy

# Clone Bevel
git clone https://github.com/hyperledger-bevel/bevel.git

# Verify it cloned successfully
ls -la bevel/
```

## 4. Setup Python Virtual Environment
If you haven't installed python yet, install it now:
```console
# update packages first
sudo apt update

# install
sudo apt install python3 python3-pip
```

```console
cd ~/fabric-video-privacy

# Create virtual environment
python3 -m venv bevel-env

# Activate it
source bevel-env/bin/activate

# Your prompt should now show (bevel-env) at the beginning
# Verify Python is from the virtual environment
which python
```

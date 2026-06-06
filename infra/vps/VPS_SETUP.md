# VPS Setup Guide

This guide configures one VPS for backend, admin, Docker Compose, Nginx, and SSL.

## 1) Install Docker and Nginx

```bash    
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release nginx certbot python3-certbot-nginx
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release; echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out and log in again after adding docker group.

## 2) Clone project on VPS

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone https://github.com/neerajk001/paramsukh.git saas-native
cd /var/www/saas-native
```

## 3) Prepare runtime env files

```bash
cp infra/vps/backend.env.example backend/.env
cp infra/vps/admin.env.production.example admin/.env.production
cp infra/vps/compose.env.example .env
```

Edit values with production credentials and domains.

Important for admin auth:
- In `.env` (project root), set `NEXT_PUBLIC_ADMIN_API_KEY` and keep it exactly the same as `ADMIN_API_KEY` in `backend/.env`.
- If this key changes, rebuild admin image before restart so the new key is baked into the frontend bundle.

## 4) First local container start

```bash
docker compose build backend admin
docker compose up -d backend admin
docker compose ps
curl http://127.0.0.1:3000/health
```

## 5) Configure Nginx vhosts

```bash
sudo cp infra/vps/nginx/api.example.com.conf /etc/nginx/sites-available/api.example.com
sudo cp infra/vps/nginx/admin.example.com.conf /etc/nginx/sites-available/admin.example.com
```

Open both files and replace domains:
- api.example.com -> your API domain
- admin.example.com -> your admin domain

Enable sites:

```bash
sudo ln -s /etc/nginx/sites-available/api.example.com /etc/nginx/sites-enabled/api.example.com
sudo ln -s /etc/nginx/sites-available/admin.example.com /etc/nginx/sites-enabled/admin.example.com
sudo nginx -t
sudo systemctl reload nginx
```

## 6) Issue SSL certificates

```bash
sudo certbot --nginx -d api.example.com -d admin.example.com
sudo systemctl status certbot.timer
```

## 7) GitHub Actions deploy prerequisites

Your repository secrets should include:
- VPS_HOST
- VPS_USER
- VPS_SSH_KEY
- VPS_PROJECT_PATH
- GHCR_USERNAME
- GHCR_TOKEN
- EXPO_TOKEN

Set VPS_PROJECT_PATH to:

```text
/var/www/saas-native
```

## 8) Mobile production API URL

Set mobile API URL in app config:
- mobile/app.json -> expo.extra.apiUrl = https://api.your-domain.com

Then build via workflow tag:

```bash
git tag mobile-v1.0.0
git push origin mobile-v1.0.0
```

## 9) Rotate exposed credentials

If any secrets were committed during development, rotate them before production:
- Google OAuth client secret
- JWT secret
- Admin API key
- Any API keys in .env files


# Convolutional Neural Network (CNN)

## Definition

A Convolutional Neural Network (CNN) is a type of deep learning neural network mainly used for processing images and visual data.

CNN automatically learns important features like:

* edges
* shapes
* textures
* objects

from images without manual feature extraction. ([GeeksforGeeks][1])

---

# Why CNN is Used

Traditional neural networks treat images like simple numbers.

CNN understands:

* spatial relationships
* nearby pixels
* image patterns

which makes it very powerful for computer vision tasks. ([Simplilearn.com][2])

---

# Basic CNN Architecture

Input Image → Convolution → Activation → Pooling → Fully Connected Layer → Output

---

# Main Components of CNN

# 1. Input Layer   

* Takes image as input.
* Image is represented in matrix form.

Example:

* RGB image → Width × Height × 3 channels
    
Example:
32 × 32 × 3

---

# 2. Convolution Layer

Most important layer of CNN.

## Working

* Small filters/kernels slide over image.
* Feature extraction happens.
* Detects:

  * edges
  * corners
  * textures
  * shapes

This operation is called convolution. ([GeeksforGeeks][3])

---

# Kernel / Filter

A small matrix used to scan the image.

Common sizes:

* 3×3
* 5×5
* 7×7

Each filter learns a specific feature.

---

# Stride

Stride means:

> Number of steps the filter moves.

* Stride = 1 → slow movement, more detail
* Stride = 2 → faster movement, smaller output

---

# Padding

Padding adds extra zeros around image borders.

## Why Padding is Used

* Prevents image size reduction
* Preserves edge information

Types:

* Valid Padding → no padding
* Same Padding → output size same as input

---

# 3. Activation Function

After convolution, activation function is applied.

Mostly ReLU is used.

f(x)=\max(0,x)

## Purpose

* Introduces non-linearity
* Helps network learn complex patterns
  
---

# 4. Pooling Layer

Pooling reduces feature map size.

## Purpose

* Reduces computation
* Reduces overfitting
* Keeps important features

---

# Types of Pooling

## A) Max Pooling

Takes maximum value from region.

Most commonly used.

---

## B) Average Pooling

Takes average value from region.

---

# 5. Flattening

Converts 2D feature maps into 1D vector.

This data is then passed to dense layers.

---

# 6. Fully Connected Layer

Performs final classification.

Every neuron is connected to all neurons of previous layer.

---

# 7. Output Layer

Produces final prediction.

Examples:

* Cat
* Dog
* Car
* Human

Softmax activation is commonly used.

---

# Working of CNN Step-by-Step

## Step 1

Input image is given.

---

## Step 2

Convolution layer extracts features.

---

## Step 3

Activation function introduces non-linearity.

---

## Step 4

Pooling reduces dimensions.

---

## Step 5

Flattening converts data into vector form.

---

## Step 6

Fully connected layer performs classification.

---

## Step 7

Output layer gives prediction.

---

# Advantages of CNN

## 1. Automatic Feature Extraction

No manual feature engineering required.

---

## 2. High Accuracy

Very effective in image recognition tasks.

---

## 3. Parameter Sharing

Same filter used across image.

Reduces number of parameters.

---

## 4. Translation Invariance

Can recognize objects even if position changes.

---

# Disadvantages of CNN

## 1. Requires Large Dataset

Needs huge training data.

---

## 2. High Computational Cost

Training is expensive.

---

## 3. Requires GPU

Deep CNN models require powerful hardware.

---

# Applications of CNN

## 1. Image Classification

* Cat vs Dog
* Face recognition

---

## 2. Object Detection

Used in:

* self-driving cars
* surveillance

---

## 3. Medical Imaging

Detects:

* tumors
* cancer
* diseases

---

## 4. Facial Recognition

Used in mobile face unlock.

---

## 5. OCR

Used in handwritten text recognition.

---

# Popular CNN Architectures

* LeNet
* AlexNet
* VGGNet
* ResNet
* GoogLeNet

([GeeksforGeeks][4])

---

# Conclusion

CNN is one of the most important deep learning models for image processing and computer vision.

It automatically learns image features using:

* convolution
* activation
* pooling
* fully connected layers

which makes it highly effective for real-world AI applications. ([GeeksforGeeks][1])

And honestly…

CNN is basically:

> “A machine slowly becoming an expert at spotting cats.” 😭

[1]: https://www.geeksforgeeks.org/deep-learning/convolutional-neural-network-cnn-in-machine-learning/?utm_source=chatgpt.com "Convolutional Neural Network (CNN) in Deep Learning"
[2]: https://www.simplilearn.com/tutorials/deep-learning-tutorial/convolutional-neural-network?utm_source=chatgpt.com "CNN in Deep Learning: Algorithm and Machine ..."
[3]: https://www.geeksforgeeks.org/machine-learning/introduction-convolution-neural-network/?utm_source=chatgpt.com "Introduction to Convolution Neural Network"
[4]: https://www.geeksforgeeks.org/machine-learning/convolutional-neural-network-cnn-architectures/?utm_source=chatgpt.com "Convolutional Neural Network (CNN) Architectures"

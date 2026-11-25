# Smart Lighting Digital Twin System

A real-time **IoT & Digital Twin** prototype for smart street lighting that synchronizes an ESP32 hardware node (simulated on Wokwi) with a live web dashboard using **MQTT**, **ASP.NET Core Web API**, **SignalR**, and **React**.

---

## Architecture Overview

```text
ESP32 (Wokwi)  <--- MQTT --->  ASP.NET Core Web API  <--- SignalR --->  React Dashboard
(LDR, HC-SR04, LED)          (MqttDigitalTwinWorker & StreetLightHub)    (street-twin-ui)
```

## Key Features
* **Real-Time Bi-Directional Sync:** Streams live sensor telemetry (ambient light, distance, lamp state) from the ESP32 to the dashboard and sends remote control commands back to the hardware.
* **Adaptive Lighting Control:** Automatically adjusts street lamp state using an **LDR sensor** (day/night detection) and an **HC-SR04 ultrasonic sensor** (vehicle/pedestrian proximity).
* **Automated Lamp Fault Detection:** Detects discrepancies between expected and actual lamp states and pushes instant alerts to the UI via **SignalR**.

---

## Project Structure

```text
Smart_Lighting_Digital_Twin_System/
├── SmartLightingDigitalTwinApi/   # ASP.NET Core Web API (MQTT Worker, SignalR Hub, Pole Models)
├── street-twin-ui/                # React + Vite + Tailwind CSS Live Dashboard
├── esp32-wokwi/                   # ESP32 Firmware (sketch.ino) & Wokwi Circuit (diagram.json)
├── .gitignore
└── README.md
```

---

## How to Run Locally

### 1. Clone the Repository
```bash
git clone [https://github.com/Nader-Yaser/Smart_Lighting_Digital_Twin_System.git](https://github.com/Nader-Yaser/Smart_Lighting_Digital_Twin_System.git)
cd Smart_Lighting_Digital_Twin_System
```

### 2. Run the Backend (.NET API)
```bash
cd SmartLightingDigitalTwinApi
dotnet restore
dotnet run
```
> Starts the ASP.NET Core server, connects `MqttDigitalTwinWorker` to the MQTT broker, and initializes `StreetLightHub` for SignalR clients.

### 3. Run the Frontend (React UI)
Open a new terminal window:
```bash
cd street-twin-ui
npm install
npm run dev
```
> Open the local URL printed in the terminal (default: `http://localhost:5173`).

### 4. Run the ESP32 Simulation (Wokwi)
1. Open [Wokwi](https://wokwi.com/) and create a new **ESP32** project.
2. Copy the code and wiring files from the `esp32-wokwi/` folder (`sketch.ino` and `diagram.json`) into the simulator.
3. Click **Start Simulation** to connect the virtual street pole to the system.
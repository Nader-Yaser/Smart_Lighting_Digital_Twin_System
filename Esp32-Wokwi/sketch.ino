#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// إعدادات الشبكة الافتراضية في Wokwi
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASS = "";

// إعدادات وسيط MQTT العام المجاني
const char* MQTT_BROKER = "broker.hivemq.com";
const int   MQTT_PORT   = 1883;

// تعريف هوية العمود وقنوات الاتصال
const char* POLE_ID       = "pole01";
const char* TELEMETRY_TOP = "city/street1/pole01/telemetry";
const char* COMMAND_TOP   = "city/street1/pole01/command";

// أطراف التوصيل (Pins)
const int LDR_PIN  = 34;
const int TRIG_PIN = 5;
const int ECHO_PIN = 18;
const int LED_PIN  = 19;

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// حالة التوأم الرقمي المحلية (Device State)
String operatingMode   = "AUTO"; // AUTO أو MANUAL
int manualBrightness   = 0;
int currentBrightness  = 0;      // من 0 إلى 100%
bool simulatedFault    = false;  // لمحاكاة احتراق اللمبة أثناء العرض
unsigned long lastPublishTime = 0;

// دالة استقبال الأوامر من الـ Backend / Dashboard
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  if (error) return;

  if (doc.containsKey("mode")) {
    operatingMode = doc["mode"].as<String>();
  }
  if (doc.containsKey("brightness")) {
    manualBrightness = constrain(doc["brightness"].as<int>(), 0, 100);
  }
  if (doc.containsKey("simulateFault")) {
    simulatedFault = doc["simulateFault"].as<bool>();
  }

  Serial.println("Command received -> Mode: " + operatingMode + 
                 " | Manual: " + String(manualBrightness) + 
                 " | FaultSim: " + String(simulatedFault));
}

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println(" Connected!");
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    String clientId = "ESP32-StreetPole-" + String(random(0xffff), HEX);
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("Connected to MQTT Broker!");
      mqttClient.subscribe(COMMAND_TOP);
    } else {
      delay(2000);
    }
  }
}

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return 400.0; // لا يوجد جسم قريب
  return duration * 0.034 / 2.0;
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);

  connectWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
}

void loop() {
  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop();

  // 1. قراءة الحساسات
  // في Wokwi: القيمة 4063 تعني ظلام دامس، و 32 تعني إضاءة شمس ساطعة
  int rawLdr = analogRead(LDR_PIN);
  int ambientLightPct = constrain(map(rawLdr, 32, 4063, 100, 0), 0, 100);
  float distanceCm = readDistanceCm();
  bool trafficDetected = (distanceCm < 120.0);

  // 2. تحديد شدة الإضاءة المطلوبة
  if (operatingMode == "MANUAL") {
    currentBrightness = manualBrightness;
  } else {
    if (ambientLightPct > 50) {
      currentBrightness = 0;   // وقت النهار: إطفاء كامل
    } else if (trafficDetected) {
      currentBrightness = 100; // ليل + مرور سيارة: إضاءة كاملة
    } else {
      currentBrightness = 25;  // ليل + شارع هادئ: وضع توفير الطاقة
    }
  }

  // 3. التحكم الفعلي في الـ LED عبر PWM (0 - 255)
  int pwmValue = simulatedFault ? 0 : map(currentBrightness, 0, 100, 0, 255);
  analogWrite(LED_PIN, pwmValue);

  // 4. حساب الطاقة المسحوبة (بافتراض قدرة الكشاف القصوى 100 وات)
  float powerWatts = simulatedFault ? 0.0 : (currentBrightness / 100.0) * 100.0;

  // 5. إرسال البيانات إلى التوأم الرقمي كل ثانيتين
  if (millis() - lastPublishTime >= 2000) {
    lastPublishTime = millis();

    StaticJsonDocument<256> telemetry;
    telemetry["poleId"]          = POLE_ID;
    telemetry["ambientLightPct"] = ambientLightPct;
    telemetry["distanceCm"]      = round(distanceCm * 10) / 10.0;
    telemetry["trafficDetected"] = trafficDetected;
    telemetry["brightness"]      = currentBrightness;
    telemetry["powerWatts"]      = powerWatts;
    telemetry["mode"]            = operatingMode;

    char jsonBuffer[256];
    serializeJson(telemetry, jsonBuffer);
    mqttClient.publish(TELEMETRY_TOP, jsonBuffer);

    Serial.println(jsonBuffer);
  }
}
/*
 * Copyright (c) 2016 RedBear
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */
#include <nRF5x_BLE_API.h>

#define DEVICE_NAME       "BLENano_Bo"
#define PUMP_PIN          P0_3
// const int PUMP_PIN = 2;
// BLE UUIDs
UUID serviceUUID(0xA000);
UUID connUUID(0xA001);
UUID pumpDurUUID(0xA002);
UUID pumpNotifyUUID(0xA003);
UUID rfidUUID(0xA004);

// BLE Object
BLE ble;

// Characteristic values
uint8_t connValue[2] = {0, 0};
uint8_t pumpDurValue[2] = {0, 0};
uint8_t pumpNotifyValue[4] = {0, 0, 0, 0};
uint8_t rfidValue[13] = {0};

// Characteristics
GattCharacteristic connChar(connUUID, connValue, sizeof(connValue), sizeof(connValue),
    GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_WRITE | GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_WRITE_WITHOUT_RESPONSE);

GattCharacteristic pumpDurChar(pumpDurUUID, pumpDurValue, sizeof(pumpDurValue), sizeof(pumpDurValue),
    GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_WRITE | GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_WRITE_WITHOUT_RESPONSE);

GattCharacteristic pumpNotifyChar(pumpNotifyUUID, pumpNotifyValue, sizeof(pumpNotifyValue), sizeof(pumpNotifyValue),
    GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_READ | GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_NOTIFY);

GattCharacteristic rfidChar(rfidUUID, rfidValue, sizeof(rfidValue), sizeof(rfidValue),
    GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_READ | GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_NOTIFY);

// Service
GattCharacteristic *allChars[] = {&connChar, &pumpDurChar, &pumpNotifyChar, &rfidChar};
GattService pumpService(serviceUUID, allChars, sizeof(allChars) / sizeof(GattCharacteristic*));

// Variables
volatile uint16_t pumpDuration = 0;
volatile bool pumpTriggered = false;
unsigned long pumpStartTime = 0;
bool pumpRunning = false;

// Callbacks
void onDisconnect(const Gap::DisconnectionCallbackParams_t *params) {
    Serial.println("Disconnected!");
    digitalWrite(PUMP_PIN, LOW);
    pumpRunning = false;
    ble.gap().startAdvertising();
}

void onConnect(const Gap::ConnectionCallbackParams_t *params) {
    Serial.println("Connected!");
}

void onDataWritten(const GattWriteCallbackParams *params) {
    if (params->handle == pumpDurChar.getValueHandle()) {
        pumpDuration = params->data[0] | (params->data[1] << 8);
        Serial.print("Pump: ");
        Serial.print(pumpDuration);
        Serial.println(" ms");
        
        if (pumpDuration > 0) {
            pumpTriggered = true;
        }
    }
}

void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("MKTurk Pump - BLE Nano v2");
    Serial.println("-------------------------");
    
    pinMode(PUMP_PIN, OUTPUT);
    digitalWrite(PUMP_PIN, LOW);
    
    Serial.println("1. Pump pin ready");
    
    // Test pump
    digitalWrite(PUMP_PIN, HIGH);
    delay(100);
    digitalWrite(PUMP_PIN, LOW);
    Serial.println("2. Pump test done");
    
    // Initialize BLE
    Serial.println("3. Init BLE...");
    ble.init();
    Serial.println("4. BLE init done");
    
    // Set callbacks
    Serial.println("5. Setting callbacks...");
    ble.gap().onConnection(onConnect);
    ble.gap().onDisconnection(onDisconnect);
    ble.gattServer().onDataWritten(onDataWritten);
    Serial.println("6. Callbacks set");
    
    // Add service
    Serial.println("7. Adding service...");
    ble.gattServer().addService(pumpService);
    Serial.println("8. Service added");
    
    // Setup advertising
    Serial.println("9. Setup advertising...");
    ble.gap().accumulateAdvertisingPayload(GapAdvertisingData::BREDR_NOT_SUPPORTED | GapAdvertisingData::LE_GENERAL_DISCOVERABLE);
    ble.gap().accumulateAdvertisingPayload(GapAdvertisingData::COMPLETE_LOCAL_NAME, (uint8_t *)DEVICE_NAME, sizeof(DEVICE_NAME));
    ble.gap().setAdvertisingType(GapAdvertisingParams::ADV_CONNECTABLE_UNDIRECTED);
    ble.gap().setAdvertisingInterval(160);
    Serial.println("10. Starting advertising...");
    ble.gap().startAdvertising();
    
    Serial.println("11. READY!");
    Serial.print("Device: ");
    Serial.println(DEVICE_NAME);
}

void loop() {
    ble.waitForEvent();
    
    if (pumpTriggered) {
        pumpTriggered = false;
        pumpStartTime = millis();
        pumpRunning = true;
        digitalWrite(PUMP_PIN, HIGH);
        Serial.println("PUMP ON!");
    }
    
    if (pumpRunning) {
        if (millis() - pumpStartTime >= pumpDuration) {
            digitalWrite(PUMP_PIN, LOW);
            pumpRunning = false;
            Serial.println("PUMP OFF");
        }
    }
}
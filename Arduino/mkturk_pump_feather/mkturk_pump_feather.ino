/*
 * MKTurk Pump Controller - Adafruit Feather nRF52832
 * Emulates the RedBear BLE Nano pump controller
 * 
 * Service UUID: 0xA000
 * Characteristics:
 *   0xA001 - Connection/ping (write)
 *   0xA002 - Pump duration (write) - triggers pump
 *   0xA003 - Pump notification (notify)
 *   0xA004 - RFID (notify) - placeholder
 */

#include <bluefruit.h>

// ============== CONFIGURATION ==============
#define DEVICE_NAME       "BLENano_Dev"    // Change this to your preferred name
#define PUMP_PIN          7                 // GPIO pin connected to pump/LED for testing

// ============== BLE UUIDs ==============
// Custom service UUID
#define SERVICE_UUID      0xA000

// Characteristic UUIDs
#define CONN_UUID         0xA001    // Connection/ping
#define PUMP_DUR_UUID     0xA002    // Pump duration (triggers pump)
#define PUMP_NOTIFY_UUID  0xA003    // Pump notification
#define RFID_UUID         0xA004    // RFID placeholder

// ============== BLE SERVICE & CHARACTERISTICS ==============
BLEService        pumpService(SERVICE_UUID);
BLECharacteristic connChar(CONN_UUID);
BLECharacteristic pumpDurChar(PUMP_DUR_UUID);
BLECharacteristic pumpNotifyChar(PUMP_NOTIFY_UUID);
BLECharacteristic rfidChar(RFID_UUID);

// ============== VARIABLES ==============
volatile uint16_t pumpDuration = 0;
volatile bool pumpTriggered = false;
unsigned long pumpStartTime = 0;
bool pumpRunning = false;

// ============== SETUP ==============
void setup() {
    Serial.begin(115200);
    while (!Serial) delay(10);  // Wait for serial (optional, remove for standalone)
    
    Serial.println("MKTurk Pump Controller - Adafruit Feather nRF52832");
    Serial.println("--------------------------------------------------");
    
    // Setup pump pin
    pinMode(PUMP_PIN, OUTPUT);
    digitalWrite(PUMP_PIN, LOW);
    
    // Test pump on startup (brief flash)
    Serial.println("Testing pump pin...");
    digitalWrite(PUMP_PIN, HIGH);
    delay(100);
    digitalWrite(PUMP_PIN, LOW);
    Serial.println("Pump pin test complete");
    
    // Initialize Bluefruit
    Serial.println("Initializing Bluefruit...");
    Bluefruit.begin();
    Bluefruit.setName(DEVICE_NAME);
    Bluefruit.setTxPower(4);  // Max power for better range
    
    // Set callbacks
    Bluefruit.Periph.setConnectCallback(connect_callback);
    Bluefruit.Periph.setDisconnectCallback(disconnect_callback);
    
    // Setup BLE service and characteristics
    setupPumpService();
    
    // Start advertising
    startAdvertising();
    
    Serial.println("Setup complete! Waiting for connection...");
}

// ============== BLE SERVICE SETUP ==============
void setupPumpService() {
    pumpService.begin();
    
    // Connection characteristic (0xA001) - Write without response
    connChar.setProperties(CHR_PROPS_WRITE_WO_RESP);
    connChar.setPermission(SECMODE_OPEN, SECMODE_OPEN);
    connChar.setFixedLen(2);
    connChar.setWriteCallback(conn_write_callback);
    connChar.begin();
    
    // Pump duration characteristic (0xA002) - Write without response
    pumpDurChar.setProperties(CHR_PROPS_WRITE_WO_RESP | CHR_PROPS_WRITE);
    pumpDurChar.setPermission(SECMODE_OPEN, SECMODE_OPEN);
    pumpDurChar.setFixedLen(2);
    pumpDurChar.setWriteCallback(pump_write_callback);
    pumpDurChar.begin();
    
    // Pump notification characteristic (0xA003) - Notify
    pumpNotifyChar.setProperties(CHR_PROPS_READ | CHR_PROPS_NOTIFY);
    pumpNotifyChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
    pumpNotifyChar.setFixedLen(4);
    pumpNotifyChar.begin();
    
    // RFID characteristic (0xA004) - Notify (placeholder)
    rfidChar.setProperties(CHR_PROPS_READ | CHR_PROPS_NOTIFY);
    rfidChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
    rfidChar.setFixedLen(13);
    rfidChar.begin();
    
    Serial.println("BLE Service and Characteristics configured");
}

// ============== ADVERTISING ==============
void startAdvertising() {
    Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
    Bluefruit.Advertising.addTxPower();
    Bluefruit.Advertising.addService(pumpService);
    Bluefruit.Advertising.addName();
    
    Bluefruit.Advertising.restartOnDisconnect(true);
    Bluefruit.Advertising.setInterval(32, 244);  // in units of 0.625 ms
    Bluefruit.Advertising.setFastTimeout(30);
    Bluefruit.Advertising.start(0);  // 0 = Don't stop advertising
    
    Serial.println("Advertising started");
}

// ============== CONNECTION CALLBACKS ==============
void connect_callback(uint16_t conn_handle) {
    BLEConnection* conn = Bluefruit.Connection(conn_handle);
    char central_name[32] = { 0 };
    conn->getPeerName(central_name, sizeof(central_name));
    
    Serial.print("Connected to: ");
    Serial.println(central_name);
}

void disconnect_callback(uint16_t conn_handle, uint8_t reason) {
    Serial.print("Disconnected, reason = 0x");
    Serial.println(reason, HEX);
    
    // Turn off pump if running
    digitalWrite(PUMP_PIN, LOW);
    pumpRunning = false;
}

// ============== CHARACTERISTIC CALLBACKS ==============
void conn_write_callback(uint16_t conn_hdl, BLECharacteristic* chr, uint8_t* data, uint16_t len) {
    // Connection/ping received
    if (len >= 2) {
        uint16_t value = data[0] | (data[1] << 8);  // Little-endian
        Serial.print("Ping received: ");
        Serial.println(value);
    }
}

void pump_write_callback(uint16_t conn_hdl, BLECharacteristic* chr, uint8_t* data, uint16_t len) {
    // Pump duration received
    if (len >= 2) {
        pumpDuration = data[0] | (data[1] << 8);  // Little-endian (Int16)
        
        Serial.print("Pump command received: ");
        Serial.print(pumpDuration);
        Serial.println(" ms");
        
        // Trigger pump
        if (pumpDuration > 0) {
            pumpTriggered = true;
            pumpStartTime = millis();
            pumpRunning = true;
            digitalWrite(PUMP_PIN, HIGH);
            
            Serial.println("PUMP ON!");
        }
    }
}

// ============== MAIN LOOP ==============
void loop() {
    // Handle pump timing
    if (pumpRunning) {
        if (millis() - pumpStartTime >= pumpDuration) {
            // Turn off pump
            digitalWrite(PUMP_PIN, LOW);
            pumpRunning = false;
            
            Serial.println("PUMP OFF");
            
            // Send notification that pump completed
            uint32_t notifyValue = pumpDuration;
            pumpNotifyChar.notify(&notifyValue, sizeof(notifyValue));
        }
    }
    
    // Small delay to prevent tight loop
    delay(1);
}
/*
 * Adafruit Feather 32u4 Bluefruit LE - Pump Controller
 * Controls pump via USB Serial communication
 * 
 * Protocol: Receives 2-byte duration in milliseconds
 * Example: Send [0x00, 0x64] = 100ms pump pulse
 */

#define PUMP_PIN 5  // Digital pin 5 for pump control

void setup() {
    // Initialize serial communication
    Serial.begin(115200);
    delay(2000);  // Wait for serial to initialize
    
    // Initialize pump pin
    pinMode(PUMP_PIN, OUTPUT);
    digitalWrite(PUMP_PIN, LOW);
    
    Serial.println("Feather 32u4 Pump Controller Ready");
    Serial.println("Waiting for pump commands...");
}

void loop() {
    // Check if data is available on serial
    if (Serial.available() >= 2) {
        // Read 2 bytes (duration in milliseconds)
        byte byte1 = Serial.read();
        byte byte2 = Serial.read();
        
        // Combine bytes into 16-bit unsigned integer
        uint16_t duration = (byte2 << 8) | byte1;
        
        Serial.print("Pump command received: ");
        Serial.print(duration);
        Serial.println(" ms");
        
        // Trigger pump
        triggerPump(duration);
    }
}

void triggerPump(uint16_t durationMs) {
    Serial.println("Pump ON");
    digitalWrite(PUMP_PIN, HIGH);
    delay(durationMs);
    digitalWrite(PUMP_PIN, LOW);
    Serial.println("Pump OFF");
}
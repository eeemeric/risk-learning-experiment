/*
 * MKTurk Pump Controller - RedBear BLE Nano v2
 * Based on original RedBear code
 * 
 * Service UUID: 0xA000
 * Characteristics:
 *   0xA001 - Connection/ping (write)
 *   0xA002 - Pump duration (write) - triggers pump
 */

#include "ble/BLE.h"

// ============== PIN DEFINITIONS ==============
DigitalOut ledpump(P0_19, 1);   // pin 19: D13 (onboard LED)
DigitalOut pumpon(P0_28, 1);    // pin 28: D4 (pump control)

// ============== BLE UUIDs ==============
uint16_t customServiceUUID          = 0xA000;  // Service
uint16_t writeUUID_connectionstatus = 0xA001;  // Connection/ping
uint16_t writeUUID_pumpduration     = 0xA002;  // Pump duration

// ============== DEVICE NAME ==============
const static char DEVICE_NAME[] = "BLENano_Bo";
static const uint16_t uuid16_list[] = {0xFFFF};

// ============== CHARACTERISTICS ==============
static uint8_t connectionStatusValue[2] = {0};
GattCharacteristic writeConnectionStatusChar(writeUUID_connectionstatus,
    connectionStatusValue, sizeof(connectionStatusValue), sizeof(connectionStatusValue),
    GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_WRITE_WITHOUT_RESPONSE);

static uint8_t pumpDurationValue[2] = {0};
GattCharacteristic writePumpDurationChar(writeUUID_pumpduration,
    pumpDurationValue, sizeof(pumpDurationValue), sizeof(pumpDurationValue),
    GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_WRITE_WITHOUT_RESPONSE);

// ============== SERVICE ==============
GattCharacteristic *characteristics[] = {
    &writeConnectionStatusChar,
    &writePumpDurationChar,
};
GattService customService(customServiceUUID, characteristics, 
    sizeof(characteristics) / sizeof(GattCharacteristic *));

// ============== CALLBACKS ==============
void messageReceivedCallback(const GattWriteCallbackParams *params) {
    
    // Only respond to pump and ping commands
    if(params->handle == writePumpDurationChar.getValueHandle() || 
       params->handle == writeConnectionStatusChar.getValueHandle()) {

        // Get duration from command
        short* pdatashort = (short*) params->data;
        float duration = ((float) *pdatashort / 1000.);
        
        printf("Received command, duration: %d ms\n\r", int(duration * 1000));

        // Execute the pump command
        if (params->handle == writePumpDurationChar.getValueHandle()) {
            printf("Pump ON\n\r");
            ledpump = 0;  // onboard LED has reverse logic
            pumpon = 1;   // pump ON
            wait(duration);
            pumpon = 0;   // pump OFF
            ledpump = 1;  // LED off
            printf("Pump OFF\n\r");
        }

        // Blink LED whenever we receive ping
        if (params->handle == writeConnectionStatusChar.getValueHandle()) {
            printf("Ping received\n\r");
            ledpump = 0;
            wait(duration);
            ledpump = 1;
        }
    }
}

void disconnectionCallback(const Gap::DisconnectionCallbackParams_t *) {
    printf("Disconnected\n\r");
    BLE::Instance(BLE::DEFAULT_INSTANCE).gap().startAdvertising();
}

void bleInitComplete(BLE::InitializationCompleteCallbackContext *params) {
    BLE &ble = params->ble;
    ble_error_t error = params->error;
    
    if (error != BLE_ERROR_NONE) {
        printf("BLE init error: %d\n\r", error);
        return;
    }

    printf("BLE initialized successfully\n\r");

    // Set up callbacks
    ble.gap().onDisconnection(disconnectionCallback);
    ble.gattServer().onDataWritten(messageReceivedCallback);

    // Set up advertising
    ble.gap().accumulateAdvertisingPayload(GapAdvertisingData::BREDR_NOT_SUPPORTED | 
                                           GapAdvertisingData::LE_GENERAL_DISCOVERABLE);
    ble.gap().setAdvertisingType(GapAdvertisingParams::ADV_CONNECTABLE_UNDIRECTED);
    ble.gap().accumulateAdvertisingPayload(GapAdvertisingData::COMPLETE_LOCAL_NAME, 
                                           (uint8_t*) DEVICE_NAME, sizeof(DEVICE_NAME));
    ble.gap().accumulateAdvertisingPayload(GapAdvertisingData::COMPLETE_LIST_16BIT_SERVICE_IDS, 
                                           (uint8_t*) uuid16_list, sizeof(uuid16_list));
    ble.gap().setAdvertisingInterval(25);
    
    // Add service
    ble.addService(customService);

    // Start advertising
    ble.gap().startAdvertising();
    printf("Advertising started\n\r");
}

// ============== MAIN ==============
int main(void) {
    wait(2);
    printf("Starting BLE Device: %s\n\r", DEVICE_NAME);
    printf("Pump pin: P0_28 (D4)\n\r");
    
    // Initialize pins
    ledpump = 1;  // LED off (reverse logic)
    pumpon = 0;   // Pump off
    
    // Initialize BLE
    BLE& ble = BLE::Instance(BLE::DEFAULT_INSTANCE);
    ble.init(bleInitComplete);

    // Wait for initialization
    while(ble.hasInitialized() == false) {}
    
    printf("BLE Device ready\n\r");

    // Main loop
    while (true) {
        ble.waitForEvent();
    }
}
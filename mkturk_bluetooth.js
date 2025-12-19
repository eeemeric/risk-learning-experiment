// resources:
// API - https://webbluetoothcg.github.io/web-bluetooth/
// Samples - https://googlechrome.github.io/samples/web-bluetooth/index.html
// MDN - https://developer.mozilla.org/en-US/docs/Web/API/BluetoothDevice/gatt
// Playbulb - https://googlecodelabs.github.io/candle-bluetooth/
// Implementation status - https://github.com/WebBluetoothCG/web-bluetooth/blob/gh-pages/implementation-status.md#chrome


//Performing operations that require explicit user interaction on touchstart events is deprecated
// and will be removed in M54, around October 2016.
// See https://www.chromestatus.com/features/5649871251963904 for more details.

//----retry on disconnect
//---ble status write
//---detect multiple ble devices
//---ble opt out

//================ INITIALIZE BLE VARIABLE ================//
var ble = {
  // name: "redbearlabsnano",
  name: "BLENano_PumpRFID_Setta",
  namePrefix: "BLENano_",
  serviceUUID: 0xFFFF, // Service UUID
  customserviceUUID: 0xA000,
  connectionUUID: 0xA001, // Connection status
  pumpdurationUUID: 0xA002, //pump duration, 2 bytes (write, write w/o response)
  pumpUUID: 0xA003, //notify pump opened by ble, 4 bytes (read,notify)
  rfidUUID: 0xA004, //tag unique RFID, 13 bytes (read,notify)

  device: [],
  server: [],
  service: [],
  writeconnectioncharacteristic: [],
  writepumpdurationcharacteristic: [],
  pumpcharacteristic: [],
  rfidcharacteristic: [],
  connected: false,

  ping_duration: 200,
  ping_interval: 5000,
  twrite_connection: 0,
  twrite_pumpduration: 0,
  tnotify_pump: 0,
  tnotify_rfid: 0,
  statustext: "",
}
//================ INITIALIZE BLE VARIABLE (end) ================//


//==================== CONNECT BLE ====================//
function connectBLEButtonPromise(){
  var resolveFunc
  var errFunc
  p = new Promise(function(resolve,reject){
    resolveFunc = resolve;
    errFunc = reject;
  }).then(function(resolveval){console.log('User clicked ' + resolveval)});

  function *waitforclickGenerator(){
    var buttonclicked =[-1];
    while (true){
      buttonclicked = yield buttonclicked;
      resolveFunc(buttonclicked);
    }
  }

  waitforClick = waitforclickGenerator(); // start async function
  waitforClick.next(); //move out of default state
  return p;
}

function skipBLEDevice(event){
  event.preventDefault(); //prevents additional downstream call of click listener
  waitforClick.next(1)
}

async function findBLEDevice(event){
  console.log('=== findBLEDevice() STARTED ===');
  event.preventDefault();
  try{
    console.log('About to call requestBLEDevice()');
    await requestBLEDevice()
    console.log('requestBLEDevice() completed, now calling connectBLEDeviceAndCacheCharacteristics()');
    await connectBLEDeviceAndCacheCharacteristics()
    waitforClick.next(1)    
  }
  catch(error){
    console.log('=== CAUGHT ERROR IN findBLEDevice ===');
    // Add detailed error logging here too
    console.log('findBLEDevice error:', error);
    console.log('findBLEDevice error name:', error.name);
    console.log('findBLEDevice error message:', error.message);
    
    if (ble.connected == false){
      var textstr = 'Error getting ble device/service/characteristic';
      console.log(textstr)
      ble.statustext = ble.statustext + "<br>" + textstr
      updateStatusText()
    }
  }
}

// Step 1: Manually select device -- returns a promise
async function requestBLEDevice(){
  console.log('=== requestBLEDevice() called ===');
  console.log('=== requestBLEDevice() STARTED ===');
  // Check if Web Bluetooth is available
  if (!navigator.bluetooth) {
    console.log('Web Bluetooth API not supported in this browser');
    return;
  }
  
  // Check if Web Bluetooth is available
  if (!navigator.bluetooth) {
    console.log('Web Bluetooth API not supported in this browser');
    return;
  }
  
  console.log('Web Bluetooth API is available');

  let result = Promise.resolve()
  if (ble.connected == false){
    console.log('Requesting ble device...')
    console.log('Requesting bluetooth device list')  // Replace writeTextonBlankCanvas with this
    
    // Temporary (shows all devices):
    // let options = {acceptAllDevices: true, optionalServices: [ble.customserviceUUID]}
    // Temporary test - connect to any service
    let options = {
        filters: [{namePrefix: "BLENano_"}], 
        optionalServices: ['generic_access', 'generic_attribute']  // Standard services
    }
    console.log('About to call requestDevice with options:', options);
    try{
        console.log('Calling navigator.bluetooth.requestDevice...');
        device = await navigator.bluetooth.requestDevice(options)
        console.log("found a device",device)
        device = await navigator.bluetooth.requestDevice(options)
        console.log("found a device",device)
        console.log(device.name)
        console.log(device.uuids)
        console.log('Attempting to connect to GATT server...');
        const server = await device.gatt.connect();
        console.log('Connected! Getting services...');
        const services = await server.getPrimaryServices();
        console.log('Available services:', services);
        services.forEach(service => {
        console.log('Service UUID:', service.uuid);
  
        var textstr = "found a device name: " + device.name + "<br>" + "id: " + device.id
        ble.statustext = textstr
        updateStatusText()
        ble.device=device
        ble.device.addEventListener('gattserverdisconnected',onDisconnectedBLE)
    }
    catch(error){
      // Add detailed error logging
      console.log('Detailed Bluetooth error:', error);
      console.log('Error name:', error.name);
      console.log('Error message:', error.message);
      
      if (ble.connected == false){
        var textstr = 'Still waiting for user to select device'
        console.log(textstr)
        ble.statustext = ble.statustext + "<br>" + textstr
        updateStatusText()
        return error
      }
    }
  }
  return result
}

// Step 2: Connect server & Cache characteristics -- returns a promise
async function connectBLEDeviceAndCacheCharacteristics(){
  console.log('Connecting to GATT Server...')

  server = await ble.device.gatt.connect()
    var textstr = "found a GATT server"
    console.log(textstr,server)
    ble.statustext = ble.statustext + "<br>" + textstr
    updateStatusText()
    ble.server=server

  service = await server.getPrimaryService(ble.customserviceUUID)
    //Get read characteristic
    var textstr = "found a service"
    console.log(textstr,service)
    ble.statustext = ble.statustext + "<br>" + textstr
    updateStatusText()
    ble.service=service

  characteristics = await Promise.all([
      service.getCharacteristic(ble.connectionUUID),
      service.getCharacteristic(ble.pumpdurationUUID),
      service.getCharacteristic(ble.pumpUUID),
      service.getCharacteristic(ble.rfidUUID)])
    var textstr = "found a connection, pump duration, pump, & rfid characteristics"
    console.log(textstr,characteristics)
    ble.statustext = ble.statustext + "<br>" + textstr
    updateStatusText()
    ble.writeconnectioncharacteristic=characteristics[0]
    ble.writepumpdurationcharacteristic=characteristics[1]
    ble.pumpcharacteristic=characteristics[2]
    ble.rfidcharacteristic=characteristics[3]

  await ble.pumpcharacteristic.startNotifications()
    var currentTime = performance.now()
    while (currentTime + 1000 >= performance.now()) {
    }

  await ble.rfidcharacteristic.startNotifications()
    var textstr="pump & rfid notifications started" + "<br><font color=blue>" + " bluetooth loading complete!"
    console.log(textstr)
    ble.statustext = ble.statustext + "<br>" + textstr
    updateStatusText()
    ble.pumpcharacteristic.addEventListener('characteristicvaluechanged',onPumpNotificationFromBLE)
    ble.rfidcharacteristic.addEventListener('characteristicvaluechanged',onRFIDNotificationFromBLE)
    ble.connected = true
    pingBLE()
} //connectBLEDeviceAndCacheCharacteristics
//==================== CONNECT BLE (end) ====================//


//==================== RECONNECT BLE ====================//
// adapted from: https://googlechrome.github.io/samples/web-bluetooth/automatic-reconnect.html

function onDisconnectedBLE(){
  ble.connected = false
  var textstr = 'BLE disconnected'
  console.log(textstr)
  ble.statustext = textstr
  updateHeadsUpDisplay()

  reconnectBLE()
}

async function reconnectBLE(){
  exponentialBackoff(100 /* max retries */, 2 /* seconds delay */,
    async function toTry() {
      time('Connecting to Bluetooth Device... ');
      var textstr = 'Attempting to reconnect to BLE...'
      console.log(textstr)
      ble.statustext = textstr
      updateHeadsUpDisplay()

      await connectBLEDeviceAndCacheCharacteristics()
    },
    function success() {
      console.log('> Bluetooth Device reconnected. Try disconnect it now.');
      var textstr = 'Successful reconnection!'
      console.log(textstr)
      ble.statustext = textstr
      updateHeadsUpDisplay()
    },
    function fail() {
      time('Failed to reconnect.');
      var textstr = 'Could not reconnect to Bluetooth Device after multipe tries'
      console.log(textstr)
      ble.statustext = textstr
      updateHeadsUpDisplay()
    });
}

// This function keeps calling "toTry" until promise resolves or has
// retried "max" number of times. First retry has a delay of "delay" seconds.
// "success" is called upon success.
async function exponentialBackoff(max, delay, toTry, success, fail) {
  try {
    const result = await toTry();
    success(result);
  } catch(error) {
    if (max === 0) {
      return fail();
    }
    time('Retrying in ' + delay + 's... (' + max + ' tries left)');
    setTimeout(function() {
      exponentialBackoff(--max, delay * 2, toTry, success, fail);
    }, delay * 1000);
  }
}

function time(text) {
  console.log('[' + new Date().toJSON().substr(11, 8) + '] ' + text);
}
//==================== RECONNECT BLE (end) ====================//

//============== READ NOTIFICATIONS & WRITES ==============//
async function writepumpdurationtoBLE(num){
  var arrInt8 = toBytesInt16(num)
  ble.twrite_pumpduration=performance.now()
  try{
    await ble.writepumpdurationcharacteristic.writeValue(arrInt8)
      var textstr = 'wrote ble val >> ' + num + ', byte values ' + arrInt8
      console.log(textstr)
      ble.statustext = textstr
      updateHeadsUpDisplay()
      // updateStatusText()
      // writeTextonBlankCanvas(textstr,25.5,20.5)
  }
  catch(error) {
      var textstr = 'Could not write pump duration to ble device'
      console.log(textstr)
      ble.statustext = ble.statustext + "<br>" + textstr
      updateStatusText()
  }
}

function pingBLE(){
  var arrInt8 = toBytesInt16(ble.ping_duration)
  if (ble.connected == true){
    console.log('Pinging BLE device')
    ble.writeconnectioncharacteristic.writeValue(arrInt8)
    pingTimer = setTimeout(function(){
      clearTimeout(pingTimer);
      pingBLE();
    }, ble.ping_interval)
  }
}

function onPumpNotificationFromBLE(event){
  ble.tnotify_pump=performance.now()
  var textstr = 'BLE read notification << ' +
          Math.round(ble.tnotify_pump - ble.twrite_pumpduration) + 'ms'
  console.log(textstr)
  ble.statustext = ble.statustext + "  <---->  " + textstr
  updateHeadsUpDisplay()
  // updateStatusText()
  // writeTextonBlankCanvas(textstr,400,20.5)

  let value = event.target.value
  value = value.buffer ? value : new DataView(value)
  let a = []
  for (var i = 0; i < value.byteLength; i++){
      a.push('0x' + ('00' + value.getUint8(i).toString(16)).slice(-2));
    }
    console.log('Received ble notification value << ' + a.join(' '))
}

function onRFIDNotificationFromBLE(event){
  var t0 = ble.tnotify_rfid
  ble.tnotify_rfid = performance.now()

  let value = event.target.value
  value = value.buffer ? value : new DataView(value)
  let a = []
  for (var i = 0; i < value.byteLength; i++){
      a.push('0x' + ('00' + value.getUint8(i).toString(16)).slice(-2));
    }
    console.log('Received ble notification value << ' + a.join(' '))

    var textstr = 'BLE RFID notification:  value << ' + a.join(' ') + '  interval << ' + Math.round(ble.tnotify_rfid - t0) + 'ms'
    ble.statustext = textstr
    updateHeadsUpDisplay()
}
//============== READ NOTIFICATIONS & WRITES (end) ==============//

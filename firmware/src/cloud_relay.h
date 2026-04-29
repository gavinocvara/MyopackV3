#pragma once
#include <Arduino.h>

namespace MpCloudRelay {
  void begin();
  void loop();

  void update(float l1, float l2, float r1, float r2, bool monitoring, const char* source = "ads");
  void setLabel(uint8_t ch, const char* name);

  using LabelChangeHandler = void (*)(uint8_t ch, const char* name);
  void setLabelChangeHandler(LabelChangeHandler handler);

  bool isConnected();
}

#ifndef MOMENT_RUNTIME_H
#define MOMENT_RUNTIME_H
#include "structs.h"
void Moment_InitGame(void);
void Moment_RunGameFrame(void);
int Moment_Ready(void);
void Moment_ApplyParryWindow(PLW* defender);
#endif

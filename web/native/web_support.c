/* Browser-only host services. Combat is compiled from the unmodified 3SX sources. */
#include "args.h"
#include "core/input.h"
#include "port/config/config.h"
#include "port/resources.h"
#include "arcade/rom/rom.h"
#include <SDL3/SDL.h>
#include <emscripten.h>
#include <string.h>
static Args args;
static unsigned short pads[2];
const Args* get_args(void) { return &args; }
void init_args(int argc, const char** argv) {}
void Config_Init(void) {}
void Config_Destroy(void) {}
bool Config_GetBool(const char* key) { return false; }
int Config_GetInt(const char* key) { return 0; }
const char* Config_GetString(const char* key) { return NULL; }
char* Resources_GetPath(const char* file) { char* p; SDL_asprintf(&p,"/%s",file ? file : ""); return p; }
const char* Resources_GetAFSPath(void) { return "/SF33RD.AFS"; }
bool Resources_Check(void) { return true; }
const char* Rom_GetZipName(RomGame game) { return "absent.zip"; }
Rom* Rom_Create(RomGame game,const char* path) { return NULL; }
void Rom_Destroy(Rom* rom) {}
RomGame Rom_GetGame(const Rom* rom) { return ROM_GAME_SFIII3; }
RomRegion Rom_GetSimm(const Rom* rom,int simm) { return (RomRegion){0}; }
RomRegion Rom_GetProgram(const Rom* rom) { return (RomRegion){0}; }
RomRegion Rom_GetGraphics(const Rom* rom) { return (RomRegion){0}; }
EMSCRIPTEN_KEEPALIVE void web_input(int id,int bits) { if(id>=0 && id<2) pads[id]=bits; }
bool Input_IsGamepadConnected(int id) { return id<2; }
Input_PadType Input_GetPadType(int id) { return INPUT_PAD_TYPE_PLAYSTATION; }
void Input_RumblePad(int id,bool low,Uint8 high) {}
void Input_GetButtonState(int id,Input_ButtonState* s) {
 memset(s,0,sizeof(*s)); unsigned b=pads[id&1];
 s->dpad_up=b&1; s->dpad_down=b&2; s->dpad_left=b&4; s->dpad_right=b&8;
 s->west=b&16; s->north=b&32; s->right_shoulder=b&64; s->left_shoulder=b&128;
 s->south=b&256; s->east=b&512; s->right_trigger=b&1024; s->left_trigger=b&2048;
 s->start=b&16384; s->back=b&32768;
}

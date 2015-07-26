export type INSInfo = {[ins: number]: string};

export var inses: INSInfo = {
    0x22: "Manage Security Environment",
    0x2A: "Perform Security Operation [decipher]",
    0x50: "Initialize Update",
    0x70: "Manage Channel",
    0x78: "End R-MAC Session",
    0x7A: "Begin R-MAC Session",
    0x82: "External Authenticate",
    0x84: "Get Challenge",
    0x88: "Internal Authenticate",
    0xA4: "Select",
    0xCA: "Get Data",
    0xCB: "Get Data",
    0xD8: "Put Key",
    0xE2: "Store Data",
    0xE4: "Delete",
    0xE6: "Install",
    0xE8: "Load",
    0xF0: "Set Status",
    0xF2: "Get Status"
};

export type SWInfo = {sw1: number, sw2?: number, title: string};

export var sws: SWInfo[] = [
    {sw1: 0x90, sw2: 0x00, title: "Success"},
    {sw1: 0x61,            title: "Response data incomplete, more bytes available"},
    {sw1: 0x62, sw2: 0x00, title: "Logical Channel already closed"},
    {sw1: 0x62, sw2: 0x83, title: "Card Life Cycle State is CARD_LOCKED"},
    {sw1: 0x63, sw2: 0x00, title: "External auth: Authentication of host cryptogram failed, or Verification of certificate failed"},
    {sw1: 0x63, sw2: 0x10, title: "More data available"},
    {sw1: 0x64, sw2: 0x00, title: "No specific diagnosis"},
    {sw1: 0x65, sw2: 0x81, title: "Memory failure"},
    {sw1: 0x67, sw2: 0x00, title: "Wrong length in Lc"},
    {sw1: 0x68, sw2: 0x81, title: "Logical channel not supported or is not active"},
    {sw1: 0x68, sw2: 0x82, title: "Secure messaging not supported"},
    {sw1: 0x68, sw2: 0x83, title: "The last command of the chain was expected"},
    {sw1: 0x69, sw2: 0x82, title: "Security status not satisfied"},
    {sw1: 0x69, sw2: 0x85, title: "Conditions of use not satisfied"},
    {sw1: 0x6A, sw2: 0x80, title: "Incorrect values in command data"},
    {sw1: 0x6A, sw2: 0x81, title: "Function not supported e.g. card Life Cycle State is CARD_LOCKED"},
    {sw1: 0x6A, sw2: 0x82, title: "Application/file not found"},
    {sw1: 0x6A, sw2: 0x84, title: "Not enough memory space"},
    {sw1: 0x6A, sw2: 0x86, title: "Incorrect P1 P2"},
    {sw1: 0x6A, sw2: 0x88, title: "Referenced data not found"},
    {sw1: 0x6D, sw2: 0x00, title: "Instruction not supported or invalid"},
    {sw1: 0x6E, sw2: 0x00, title: "Invalid class"},
    {sw1: 0x6F, sw2: 0x00, title: "No specific diagnosis error (typically low level error, e.g. runtime exception)"},
    {sw1: 0x94, sw2: 0x84, title: "Algorithm not supported"},
    {sw1: 0x94, sw2: 0x85, title: "Invalid key check value"}
];

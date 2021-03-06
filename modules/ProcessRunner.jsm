/* vim: sw=2 ts=2 sts=2 et filetype=javascript  
 *
 * A simple implementation to open an application with specific file.
 * For Windows, nsIProcess has lots of problem with Unicode, so js-ctypes approach is used.
 */
const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "processRunner" ];

let processRunner = {};
/**
 * Open a file with specific process, in platform-dependent ways
 *
 * @param process
 *        An nsILocalFile instance to the process to open the file
 * @param file
 *        An nsILocalFile instance to the file to be opened
 */

processRunner.openFileWithProcess = function(process, file, safeString) {
  /* In order to help AMO validation */
  if (safeString != "nsIProcess") { return; }
  
  Components.utils.import("resource://nicofox/Services.jsm"); 
  var os_string = Services.appinfo.OS;
 
  /* Windows Codes. JS-ctype is used to call ShellExecuteW in shell32.dll */ 
  if (os_string == 'WINNT') {
    /* Assemble Command Line for Win32 */
    var argument = file.path;    
    /* We need to make the argument quoted if space included */
    if (argument.match(/\s/)) {
      argument = "\"" + argument + "\"";
    }
    /* If backslash is followed by a quote, double it */
    argument = argument.replace(/\\\"/g, "\\\\\"");
  
    /* Use JS CTypes */  
    Components.utils.import("resource://gre/modules/ctypes.jsm");
    var lib = ctypes.open("shell32.dll");
    var SW_SHOW = 5;
    /* For 3.6 (1.9.2) compatiblity, though js-ctype is not suggested to use on 1.9.2. */
    var strType = (ctypes.jschar)?ctypes.jschar.ptr:ctypes.ustring;
    /* Try to find the working ABI
       http://forums.mozillazine.org/viewtopic.php?f=23&t=2059667
       Before Bug 585175 landed: use ctypes.stdcall_abi
       After Bug 585175 landed: ctypes.default_abi for 64-bit, ctypes.winapi_abi for 32-bit
     */
    var winAbi = ctypes.stdcall_abi;
    if (ctypes.winapi_abi) {
      if (ctypes.size_t.size == 8) {
        winAbi = ctypes.default_abi;
      } else {
        winAbi = ctypes.winapi_abi;
      }
    }

    var shellExecute = lib.declare("ShellExecuteW",
                                  winAbi,
                                  ctypes.int32_t, /* HINSTANCE (return) */
                                  ctypes.int32_t, /* HWND hwnd */
                                  strType, /* LPCTSTR lpOperation */
                                  strType, /* LPCTSTR lpFile */
                                  strType, /* LPCTSTR lpParameters */
                                  strType, /* LPCTSTR lpDirectory */
                                  ctypes.int32_t  /* int nShowCmd */);
    var result = shellExecute(0, "open", process.path, argument, "", SW_SHOW);
    /*if (result > 32) { return true; }
    else { return false; }*/
  
  /* OSX code. Use launchWithDoc from nsILocalFileMac */
  } else if (os_string == 'Darwin') {
        process.QueryInterface(Ci.nsILocalFileMac);
        process.launchWithDoc(file, false);
  
  /* For others, use nsIProcess with utf8 parameters */
  } else {
    var processRunner = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
    var unicode_converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
    unicode_converter.charset = 'utf-8';      
    processRunner.init(process);
    var parameter = [unicode_converter.ConvertFromUnicode(file.path)];
    processRunner.run(false, parameter, 1);
  }
};

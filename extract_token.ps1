
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.IO;

public class CredExtractor3 {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public int Flags;
        public int Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }

    [DllImport("advapi32.dll", EntryPoint = "CredEnumerateW", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CredEnumerate(string filter, int flag, out int count, out IntPtr pCredentials);

    [DllImport("advapi32.dll", EntryPoint = "CredFree")]
    static extern void CredFree(IntPtr buffer);

    public static void ExtractGogToken(string outputPath) {
        int count;
        IntPtr pCredentials;
        if (CredEnumerate(null, 0, out count, out pCredentials)) {
            for (int i = 0; i < count; i++) {
                IntPtr pCred = Marshal.ReadIntPtr(pCredentials, i * IntPtr.Size);
                CREDENTIAL cred = Marshal.PtrToStructure<CREDENTIAL>(pCred);
                string target = Marshal.PtrToStringUni(cred.TargetName);
                if (target != null && target.ToLower().Contains("gogcli") && cred.CredentialBlobSize > 0) {
                    byte[] blobBytes = new byte[cred.CredentialBlobSize];
                    Marshal.Copy(cred.CredentialBlob, blobBytes, 0, cred.CredentialBlobSize);
                    
                    // Guardar los bytes RAW directamente al disco
                    File.WriteAllBytes(outputPath + ".raw", blobBytes);
                    
                    // Intentar distintos encodings
                    string asUtf8 = Encoding.UTF8.GetString(blobBytes);
                    string asUtf16 = Encoding.Unicode.GetString(blobBytes);
                    string asAscii = Encoding.ASCII.GetString(blobBytes);
                    
                    // Mostrar los primeros bytes en hex para diagnosticar
                    StringBuilder hex = new StringBuilder();
                    for(int j = 0; j < Math.Min(32, blobBytes.Length); j++) {
                        hex.AppendFormat("{0:X2} ", blobBytes[j]);
                    }
                    Console.WriteLine("Target: " + target);
                    Console.WriteLine("Primeros bytes (hex): " + hex.ToString());
                    Console.WriteLine("Como UTF-8: " + asUtf8.Substring(0, Math.Min(100, asUtf8.Length)));
                    Console.WriteLine("Como UTF-16: " + asUtf16.Substring(0, Math.Min(100, asUtf16.Length)));
                }
            }
            CredFree(pCredentials);
        }
    }
}
"@

$outPath = Join-Path $PWD "gog_token_raw.json"
[CredExtractor3]::ExtractGogToken($outPath)

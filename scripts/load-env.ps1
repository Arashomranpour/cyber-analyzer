# Loads variables from the project-root .env into the current PowerShell session.
# Usage (from project root, dot-source so the variables persist):
#   . .\scripts\load-env.ps1
param([string]$Path = (Join-Path $PSScriptRoot "..\.env"))

Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $name, $value = $line.Split('=', 2)
    $value = $value.Trim().Trim('"').Trim("'")
    Set-Item -Path "env:$($name.Trim())" -Value $value
}

foreach ($key in "GROQ_API_KEY", "SEMGREP_APP_TOKEN") {
    $v = (Get-Item "env:$key" -ErrorAction SilentlyContinue).Value
    if ($v) { Write-Host "$key loaded: $($v.Substring(0, [Math]::Min(4, $v.Length)))..." }
    else { Write-Warning "$key not found in .env" }
}

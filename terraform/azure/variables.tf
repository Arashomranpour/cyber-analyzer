variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "cyber-analyzer"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "germanywestcentral"
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "cyber-analyzer-rg"
}

variable "groq_api_key" {
  description = "Groq API key for the application"
  type        = string
  sensitive   = true
  default     = ""
}

variable "semgrep_app_token" {
  description = "Semgrep app token for security scanning"
  type        = string
  sensitive   = true
  default     = ""
}

variable "container_image" {
  description = "Full image reference to run, e.g. <acr>.azurecr.io/cyber-analyzer:<tag>"
  type        = string
}

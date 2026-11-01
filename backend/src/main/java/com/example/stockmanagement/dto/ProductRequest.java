package com.example.stockmanagement.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record ProductRequest(
        @NotBlank @Size(max = 80) String code,
        @NotBlank @Size(max = 160) String name,
        @Size(max = 1000) String description,
        @NotNull @DecimalMin(value = "0.00") BigDecimal price,
        @NotNull @jakarta.validation.constraints.PositiveOrZero Integer quantity
) {}

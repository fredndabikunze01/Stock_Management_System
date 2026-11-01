package com.example.stockmanagement.controller;

import com.example.stockmanagement.dto.MovementResponse;
import com.example.stockmanagement.dto.StockRequest;
import com.example.stockmanagement.service.StockService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/stock")
public class StockController {
    private final StockService service;

    public StockController(StockService service) {
        this.service = service;
    }

    @PostMapping("/add")
    @ResponseStatus(HttpStatus.CREATED)
    public MovementResponse add(@Valid @RequestBody StockRequest request) {
        return service.add(request);
    }

    @PostMapping("/remove")
    @ResponseStatus(HttpStatus.CREATED)
    public MovementResponse remove(@Valid @RequestBody StockRequest request) {
        return service.remove(request);
    }

    @GetMapping("/movements")
    public List<MovementResponse> movements() {
        return service.findMovements();
    }
}

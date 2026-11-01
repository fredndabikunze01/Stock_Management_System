package com.example.stockmanagement.service;

import com.example.stockmanagement.dto.ProductRequest;
import com.example.stockmanagement.dto.ProductResponse;
import com.example.stockmanagement.exception.BusinessRuleException;
import com.example.stockmanagement.exception.ResourceNotFoundException;
import com.example.stockmanagement.model.MovementType;
import com.example.stockmanagement.model.Product;
import com.example.stockmanagement.model.StockMovement;
import com.example.stockmanagement.repository.ProductRepository;
import com.example.stockmanagement.repository.StockMovementRepository;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductService {
    private final ProductRepository products;
    private final StockMovementRepository movements;
    private final int lowStockThreshold;

    public ProductService(ProductRepository products, StockMovementRepository movements,
                          @Value("${app.low-stock-threshold}") int lowStockThreshold) {
        this.products = products;
        this.movements = movements;
        this.lowStockThreshold = lowStockThreshold;
    }

    @Transactional(readOnly = true)
    public List<ProductResponse> findAll(String query) {
        String normalized = query == null ? "" : query.trim();
        List<Product> results = normalized.isEmpty()
                ? products.findAllByOrderByNameAsc()
                : products.findByNameContainingIgnoreCaseOrCodeContainingIgnoreCaseOrderByNameAsc(
                        normalized, normalized);
        return results.stream().map(p -> ProductResponse.from(p, lowStockThreshold)).toList();
    }

    @Transactional(readOnly = true)
    public ProductResponse findById(Long id) {
        return ProductResponse.from(getProduct(id), lowStockThreshold);
    }

    @Transactional
    public ProductResponse create(ProductRequest request) {
        ensureCodeAvailable(request.code(), null);
        Product product = new Product(request.code().trim(), request.name().trim(),
                blankToNull(request.description()), request.price(), request.quantity());
        Product saved = products.save(product);
        if (saved.getQuantity() > 0) {
            movements.save(new StockMovement(saved, MovementType.IN, saved.getQuantity(), "Opening stock"));
        }
        return ProductResponse.from(saved, lowStockThreshold);
    }

    @Transactional
    public ProductResponse update(Long id, ProductRequest request) {
        Product product = getProduct(id);
        ensureCodeAvailable(request.code(), id);
        if (product.getQuantity() != request.quantity()) {
            throw new BusinessRuleException("Use the stock add/remove endpoints to change product quantity.");
        }
        product.setCode(request.code().trim());
        product.setName(request.name().trim());
        product.setDescription(blankToNull(request.description()));
        product.setPrice(request.price());
        product.setQuantity(request.quantity());
        return ProductResponse.from(products.save(product), lowStockThreshold);
    }

    @Transactional
    public void delete(Long id) {
        Product product = getProduct(id);
        if (movements.existsByProductId(id)) {
            throw new BusinessRuleException("Products with stock movement history cannot be deleted.");
        }
        products.delete(product);
    }

    Product getProduct(Long id) {
        return products.findById(id).orElseThrow(() -> new ResourceNotFoundException("Product " + id + " was not found."));
    }

    private void ensureCodeAvailable(String code, Long currentId) {
        boolean used = currentId == null ? products.existsByCodeIgnoreCase(code.trim())
                : products.existsByCodeIgnoreCaseAndIdNot(code.trim(), currentId);
        if (used) throw new BusinessRuleException("A product with code '" + code.trim() + "' already exists.");
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

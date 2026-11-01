package com.example.stockmanagement.service;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.stockmanagement.repository.ProductRepository;
import com.example.stockmanagement.repository.StockMovementRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {
    @Mock
    private ProductRepository products;
    @Mock
    private StockMovementRepository movements;

    @Test
    void findAllListsProductsWhenNoSearchIsProvided() {
        when(products.findAllByOrderByNameAsc()).thenReturn(List.of());
        ProductService service = new ProductService(products, movements, 10);

        service.findAll(null);

        verify(products).findAllByOrderByNameAsc();
    }

    @Test
    void findAllSearchesNameAndCodeWhenQueryIsProvided() {
        when(products.findByNameContainingIgnoreCaseOrCodeContainingIgnoreCaseOrderByNameAsc("keyboard", "keyboard"))
                .thenReturn(List.of());
        ProductService service = new ProductService(products, movements, 10);

        service.findAll(" keyboard ");

        verify(products)
                .findByNameContainingIgnoreCaseOrCodeContainingIgnoreCaseOrderByNameAsc("keyboard", "keyboard");
    }
}

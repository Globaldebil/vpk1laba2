const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let exchangeRates = {};

async function loadExchangeRates() {
    try {
        const data = await fs.readFile(path.join(__dirname, 'data', 'exchange-rates.json'), 'utf8');
        exchangeRates = JSON.parse(data);
        console.log('Курсы валют загружены:', Object.keys(exchangeRates).length, 'валют');
    } catch (error) {
        console.error('Ошибка загрузки курсов валют:', error);
        exchangeRates = {};
    }
}

// Сохранение курсов валют
async function saveExchangeRates() {
    try {
        await fs.writeFile(
            path.join(__dirname, 'data', 'exchange-rates.json'),
            JSON.stringify(exchangeRates, null, 2)
        );
        console.log('Курсы валют сохранены');
        return true;
    } catch (error) {
        console.error('Ошибка сохранения курсов валют:', error);
        return false;
    }
}

function convertCurrency(amount, fromCurrency, toCurrency) {
    if (!exchangeRates[fromCurrency] || !exchangeRates[toCurrency]) {
        throw new Error('Неизвестная валюта');
    }

    const amountInUSD = amount / exchangeRates[fromCurrency];
    const convertedAmount = amountInUSD * exchangeRates[toCurrency];
    
    return parseFloat(convertedAmount.toFixed(4));
}

app.get('/', (req, res) => {
    res.render('index', { 
        currencies: Object.keys(exchangeRates),
        title: 'Конвертер валют'
    });
});

app.post('/convert', (req, res) => {
    try {
        const { amount, fromCurrency, toCurrency } = req.body;
        
        if (!amount || !fromCurrency || !toCurrency) {
            return res.status(400).render('convert', {
                error: 'Все поля обязательны для заполнения',
                amount,
                fromCurrency,
                toCurrency,
                currencies: Object.keys(exchangeRates)
            });
        }

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).render('convert', {
                error: 'Введите корректную сумму',
                amount,
                fromCurrency,
                toCurrency,
                currencies: Object.keys(exchangeRates)
            });
        }

        const result = convertCurrency(numericAmount, fromCurrency, toCurrency);
        
        res.render('convert', {
            amount: numericAmount,
            fromCurrency,
            toCurrency,
            result,
            currencies: Object.keys(exchangeRates),
            success: true,
            error: null
        });

    } catch (error) {
        res.status(400).render('convert', {
            error: error.message,
            amount: req.body.amount,
            fromCurrency: req.body.fromCurrency,
            toCurrency: req.body.toCurrency,
            currencies: Object.keys(exchangeRates),
            success: false
        });
    }
});

app.get('/rates', (req, res) => {
    res.render('rates', {
        rates: exchangeRates,
        title: 'Курсы валют'
    });
});

app.get('/admin/rates', (req, res) => {
    res.render('admin-rates', {
        rates: exchangeRates,
        title: 'Редактор курсов валют',
        message: req.query.message
    });
});

app.post('/admin/rates/update', async (req, res) => {
    try {
        const { currency, rate } = req.body;
        
        if (!currency || !rate) {
            return res.redirect('/admin/rates?message=Все поля обязательны для заполнения');
        }

        const numericRate = parseFloat(rate);
        if (isNaN(numericRate) || numericRate <= 0) {
            return res.redirect('/admin/rates?message=Введите корректное значение курса');
        }

        exchangeRates[currency] = numericRate;
        
        const saved = await saveExchangeRates();
        
        if (saved) {
            res.redirect('/admin/rates?message=Курс успешно обновлен');
        } else {
            res.redirect('/admin/rates?message=Ошибка при сохранении');
        }

    } catch (error) {
        res.redirect('/admin/rates?message=Ошибка сервера');
    }
});

app.post('/admin/rates/add', async (req, res) => {
    try {
        const { newCurrency, newRate } = req.body;
        
        if (!newCurrency || !newRate) {
            return res.redirect('/admin/rates?message=Все поля обязательны для заполнения');
        }

        if (exchangeRates[newCurrency]) {
            return res.redirect('/admin/rates?message=Валюта уже существует');
        }

        const numericRate = parseFloat(newRate);
        if (isNaN(numericRate) || numericRate <= 0) {
            return res.redirect('/admin/rates?message=Введите корректное значение курса');
        }

        exchangeRates[newCurrency] = numericRate;
        
        const saved = await saveExchangeRates();
        
        if (saved) {
            res.redirect('/admin/rates?message=Валюта успешно добавлена');
        } else {
            res.redirect('/admin/rates?message=Ошибка при сохранении');
        }

    } catch (error) {
        res.redirect('/admin/rates?message=Ошибка сервера');
    }
});

app.post('/admin/rates/delete', async (req, res) => {
    try {
        const { currencyToDelete } = req.body;
        
        if (!currencyToDelete) {
            return res.redirect('/admin/rates?message=Выберите валюту для удаления');
        }

        if (!exchangeRates[currencyToDelete]) {
            return res.redirect('/admin/rates?message=Валюта не найдена');
        }

        if (currencyToDelete === 'USD') {
            return res.redirect('/admin/rates?message=Нельзя удалить базовую валюту USD');
        }


        delete exchangeRates[currencyToDelete];
        
        const saved = await saveExchangeRates();
        
        if (saved) {
            res.redirect('/admin/rates?message=Валюта успешно удалена');
        } else {
            res.redirect('/admin/rates?message=Ошибка при сохранении');
        }

    } catch (error) {
        res.redirect('/admin/rates?message=Ошибка сервера');
    }
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Что-то пошло не так!');
});

async function startServer() {
    await loadExchangeRates();
    
    app.listen(PORT, () => {
        console.log(`Сервер запущен на http://localhost:${PORT}`);
        console.log('Доступные валюты:', Object.keys(exchangeRates));
        console.log('Редактор курсов: http://localhost:3000/admin/rates');
    });
}

startServer().catch(console.error);
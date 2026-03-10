import { colors } from '@/tokens/designTokens'
import confetti from 'canvas-confetti'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import Button from '../ui/Button'
import Card from '../ui/Card'

const questions = [
  {
    question: "Who said 'I love you' first?",
    options: ['He did', 'She did', 'It was simultaneous!'],
    correct: 0,
  },
  {
    question: 'Where was our first date?',
    options: ['Coffee Shop', 'Italian Restaurant', 'The Park', 'Movies'],
    correct: 1,
  },
  {
    question: 'What is our love language?',
    options: ['Acts of Service', 'Quality Time', 'Food (obviously)', 'Gift Giving'],
    correct: 2,
  },
]

const LoveQuiz = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [score, setScore] = useState(0)
  const [showScore, setShowScore] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState(null)

  const handleAnswerClick = index => {
    setSelectedAnswer(index)
    const isCorrect = index === questions[currentQuestion].correct

    if (isCorrect) {
      setScore(score + 1)

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: [colors.gold[500], colors.gold[100], colors.neutral.white],
      })
    }

    setTimeout(() => {
      setSelectedAnswer(null)
      const nextQuestion = currentQuestion + 1
      if (nextQuestion < questions.length) {
        setCurrentQuestion(nextQuestion)
      } else {
        setShowScore(true)
        if (score + (isCorrect ? 1 : 0) === questions.length) {
          setTimeout(() => {
            confetti({
              particleCount: 200,
              spread: 120,
              origin: { y: 0.5 },
            })
          }, 300)
        }
      }
    }, 800)
  }

  const resetQuiz = () => {
    setCurrentQuestion(0)
    setScore(0)
    setShowScore(false)
    setSelectedAnswer(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className='h-full'
    >
      <Card className='w-full h-full min-h-[600px] flex flex-col justify-center bg-white/80'>
        <div className='text-center mb-8'>
          <span className='font-display text-sm font-medium tracking-[0.4em] uppercase text-gold-600 italic'>
            Chapter Four
          </span>
          <h2 className='text-dark-900 text-4xl mt-2 mb-0'>How Well Do You Know Us?</h2>
          <div className='w-[60px] h-px bg-linear-to-r from-gold-300 via-gold-500 to-gold-300 my-6 mx-auto' />
        </div>

        <AnimatePresence mode='wait'>
          {showScore ? (
            <motion.div
              key='score'
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className='text-center flex flex-col items-center gap-8'
            >
              <div className='text-[4rem]'>{score === questions.length ? '🏆' : '💝'}</div>
              <div>
                <h3 className='text-dark-900 text-5xl mb-4'>
                  You scored <span className='text-gold-600'>{score}</span> / {questions.length}
                </h3>
                <p className='text-dark-700 text-xl mb-0'>
                  {score === questions.length
                    ? 'Amazing! You really know us! 💕'
                    : 'Thanks for playing! 🎉'}
                </p>
              </div>
              <Button onClick={resetQuiz} size='lg'>
                Play Again
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className='w-full max-w-[500px] mx-auto'
            >
              {/* Progress Bar */}
              <div className='mb-8 w-full max-w-[300px] mx-auto'>
                <div className='flex justify-between text-xs text-dark-500 mb-2 uppercase tracking-wider font-semibold'>
                  <span>Question {currentQuestion + 1}</span>
                  <span>{Math.round(((currentQuestion + 1) / questions.length) * 100)}%</span>
                </div>
                <div className='w-full h-1.5 bg-black/5 rounded-full overflow-hidden'>
                  <motion.div
                    className='h-full bg-gold-500'
                    initial={{ width: 0 }}
                    animate={{
                      width: `${((currentQuestion + 1) / questions.length) * 100}%`,
                    }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                  />
                </div>
              </div>

              <h3 className='text-dark-900 text-2xl text-center mb-8 leading-tight'>
                {questions[currentQuestion].question}
              </h3>

              <div className='flex flex-col gap-4'>
                {questions[currentQuestion].options.map((option, index) => {
                  let bgColor = 'bg-white/50'
                  let borderColor = 'border-black/5'

                  if (selectedAnswer !== null) {
                    if (index === questions[currentQuestion].correct) {
                      bgColor = 'bg-green-50/50'
                      borderColor = 'border-green-500'
                    } else if (selectedAnswer === index) {
                      bgColor = 'bg-red-50/50'
                      borderColor = 'border-red-500'
                    }
                  }

                  return (
                    <motion.button
                      key={index}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAnswerClick(index)}
                      disabled={selectedAnswer !== null}
                      className={`p-5 rounded-2xl border-2 text-left flex items-center justify-between shadow-sm transition-colors duration-200 text-lg text-dark-900 ${bgColor} ${borderColor} ${
                        selectedAnswer === null
                          ? 'cursor-pointer hover:bg-white/80 hover:border-gold-300'
                          : 'cursor-default'
                      }`}
                    >
                      {option}
                      {selectedAnswer !== null && index === questions[currentQuestion].correct && (
                        <span className='text-[1.2rem]'>✅</span>
                      )}
                      {selectedAnswer === index && index !== questions[currentQuestion].correct && (
                        <span className='text-[1.2rem]'>❌</span>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}

export default LoveQuiz
